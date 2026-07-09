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

import websockets

# ── Configuration ─────────────────────────────────────────────────────────────

STREAM_ID = "spat-events"

CUIP_API_KEY = os.environ.get("CUIP_API_KEY")

# Local server
LOCAL_HOST = "0.0.0.0"
LOCAL_PORT = 8092

# ── State ─────────────────────────────────────────────────────────────────────

connected_clients: set = set()


# ── Local WebSocket server ────────────────────────────────────────────────────

async def local_ws_handler(websocket, path=None):
    global connected_clients
    print(f"[SpatBridge] App connected:    {websocket.remote_address}")
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[SpatBridge] App disconnected: {websocket.remote_address}")


async def broadcast(raw: str):
    global connected_clients
    if not connected_clients:
        return
    dead = set()
    for client in list(connected_clients):
        try:
            await client.send(raw)
        except Exception:
            dead.add(client)
    connected_clients -= dead


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

async def broadcast_loop(queue: asyncio.Queue):
    msg_count = 0
    while True:
        raw = await queue.get()
        msg_count += 1
        if msg_count <= 3:
            try:
                parsed = json.loads(raw)
                print(f"[SpatBridge] Message #{msg_count} keys: {list(parsed.keys())}")
                print(f"[SpatBridge] Message #{msg_count} raw: {raw}")
            except Exception:
                pass
        await broadcast(raw)


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
