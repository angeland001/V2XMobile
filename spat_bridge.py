"""
SPaT WebSocket Bridge
----------------------
Connects to CUIP's "spat-events" stream via the official cuip SDK (requires
VPN/network access from this machine + a CUIP_API_KEY) and re-serves it as a
local WebSocket so the Android emulator / app can reach it — same pattern as
sdsm_bridge.py.

Unlike the SDSM bridge (which speaks raw WebSocket directly to a known port),
spat-events is consumed through the documented cuip SDK entry point
(cuip.Streams(api_key).process_ws_stream(callback, "spat-events")) since the
underlying host/port routing for this stream isn't publicly documented.

The spat-events stream is multiplexed across all ~13 CUIP-instrumented
intersections; each message is expected to carry an intersection-identifying
field (mirroring the sdsm-events convention of `intersectionID`/`intersection`
seen in VehicleDisplayViewModel.ts). The app-side SpatWebSocketService logs the
first raw message it receives so the exact field names can be confirmed/
corrected against real traffic.

Usage:
    pip install websockets
    pip install ./cuip-2.0.3-py3-none-any.whl
    export CUIP_API_KEY="your_api_key_here"
    python spat_bridge.py

Android emulator → ws://10.0.2.2:8092
Physical device  → ws://<your-LAN-IP>:8092
"""

import asyncio
import json
import os
import sys
import time

import websockets

# ── Configuration ─────────────────────────────────────────────────────────────

STREAM_ID = "spat-events"

CUIP_API_KEY = os.environ.get("CUIP_API_KEY")

# Local server
LOCAL_HOST = "0.0.0.0"
LOCAL_PORT = 8092

# ── State ─────────────────────────────────────────────────────────────────────

connected_clients: set = set()
# Each connected app only ever cares about the one intersection its current
# zone is in — it tells us which via a {"subscribe": "<cuip_slug>"} message
# right after connecting. A client with no subscription yet receives nothing,
# rather than the full multiplexed firehose while it's mid-handshake.
client_subscriptions: dict = {}


# ── Local WebSocket server ────────────────────────────────────────────────────

async def local_ws_handler(websocket, path=None):
    global connected_clients
    print(f"[SpatBridge] App connected:    {websocket.remote_address}")
    connected_clients.add(websocket)
    client_subscriptions[websocket] = None
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except Exception:
                continue
            if isinstance(data, dict) and "subscribe" in data:
                subscribe_to = data["subscribe"]
                client_subscriptions[websocket] = subscribe_to if isinstance(subscribe_to, str) else None
                print(f"[SpatBridge] Client {websocket.remote_address} subscribed to: {client_subscriptions[websocket]}")
    finally:
        connected_clients.discard(websocket)
        client_subscriptions.pop(websocket, None)
        print(f"[SpatBridge] App disconnected: {websocket.remote_address}")


async def broadcast(raw: str, key: str | None):
    global connected_clients
    if not connected_clients:
        return
    dead = set()
    for client in list(connected_clients):
        # No key on the message (couldn't parse it) or no subscription from
        # this client yet — nothing to match against, so skip rather than
        # guess and send everyone everything.
        if key is None or client_subscriptions.get(client) != key:
            continue
        try:
            await client.send(raw)
        except Exception:
            dead.add(client)
    connected_clients -= dead
    for client in dead:
        client_subscriptions.pop(client, None)


# ── CUIP SDK source ────────────────────────────────────────────────────────────

async def cuip_sdk_reader(queue: asyncio.Queue):
    try:
        import cuip
    except ImportError:
        print(
            "[SpatBridge] ERROR: 'cuip' package not installed. "
            "Run: pip install ./cuip-2.0.3-py3-none-any.whl"
        )
        sys.exit(1)

    def on_message(data):
        # cuip SDK calls this synchronously per message; just hand off to the queue.
        try:
            raw = data if isinstance(data, str) else json.dumps(data)
        except Exception:
            return
        queue.put_nowait(raw)

    while True:
        try:
            print(f"[SpatBridge] Connecting to CUIP SDK stream '{STREAM_ID}'...")
            await cuip.Streams(CUIP_API_KEY).process_ws_stream(on_message, STREAM_ID)
            # process_ws_stream isn't expected to return while the stream is healthy —
            # if it does, treat it like a dropped connection and reconnect.
            print("[SpatBridge] CUIP SDK stream ended. Retrying in 3s...")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"[SpatBridge] CUIP SDK stream error: {e}. Retrying in 3s...")
            await asyncio.sleep(3)


# ── Queue → broadcast loop ────────────────────────────────────────────────────

# spat-events streams "high-frequency, with no wait times" across all ~13
# corridor intersections at once, but the app only reads its local cache
# every 500ms (SpatViewModel.FAST_UPDATE_INTERVAL) — forwarding faster than
# that just burns CPU on the client (each message costs a JSON.parse) for
# updates nobody will ever observe. Drop messages per-intersection instead of
# queuing/coalescing them: the next one is always seconds away, never lost.
MIN_BROADCAST_INTERVAL_S = 0.5

last_broadcast_at: dict = {}
seen_keys: set = set()


async def broadcast_loop(queue: asyncio.Queue):
    msg_count = 0
    while True:
        raw = await queue.get()
        msg_count += 1

        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = None

        if msg_count <= 3 and parsed is not None:
            print(f"[SpatBridge] Message #{msg_count} keys: {list(parsed.keys())}")
            print(f"[SpatBridge] Message #{msg_count} raw: {raw}")

        key = parsed.get("intersectionID") or parsed.get("intersection") or parsed.get("intersection_name") if parsed is not None else None

        if key is not None and key not in seen_keys:
            seen_keys.add(key)
            print(f"[SpatBridge] New intersection seen on the stream: {key}")

        if key is not None:
            now = time.monotonic()
            last = last_broadcast_at.get(key, 0.0)
            if now - last < MIN_BROADCAST_INTERVAL_S:
                continue
            last_broadcast_at[key] = now

        await broadcast(raw, key)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    if not CUIP_API_KEY:
        print(
            "[SpatBridge] ERROR: CUIP_API_KEY is not set.\n"
            "  export CUIP_API_KEY=\"your_api_key_here\"   (see CUIP_SDK_Readme.md)"
        )
        sys.exit(1)

    queue: asyncio.Queue = asyncio.Queue()

    print(f"[SpatBridge] Stream:        {STREAM_ID}")
    print(f"[SpatBridge] Listening on: ws://0.0.0.0:{LOCAL_PORT}")
    print(f"[SpatBridge] Emulator URL: ws://10.0.2.2:{LOCAL_PORT}")
    print(f"[SpatBridge] Physical dev: ws://<your-LAN-IP>:{LOCAL_PORT}")
    print()

    server = await websockets.serve(local_ws_handler, LOCAL_HOST, LOCAL_PORT)

    await asyncio.gather(
        server.wait_closed(),
        broadcast_loop(queue),
        cuip_sdk_reader(queue),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[SpatBridge] Stopped.")
