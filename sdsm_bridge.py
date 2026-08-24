"""
SDSM WebSocket Bridge
---------------------
Connects to CUIP data (requires VPN/network access from this machine) and
re-serves the stream as a local WebSocket so the Android emulator can reach it.

Two source modes (set SOURCE below):
  "websocket" - direct WebSocket to CUIP_WS_URL (see below)
  "redis"     - Redis pub/sub (lower latency, needs redis-py + credentials)

Usage:
    pip install websockets
    pip install redis          # only needed for SOURCE="redis"
    python sdsm_bridge.py

Android emulator → ws://10.0.2.2:8091
Physical device  → ws://<your-LAN-IP>:8091
"""

import asyncio
import json
import os
import shutil
import websockets

# ── Configuration ─────────────────────────────────────────────────────────────

SOURCE = "websocket"           # "websocket" | "redis"

# adb reverse tcp:8091 tcp:8091 lets a USB-connected physical device reach this
# bridge via ws://localhost:8091, bypassing VPN/LAN routing issues (GlobalProtect
# blocks direct LAN access to the phone while connected). The mapping silently
# drops on any USB re-enumeration (cable wiggle, phone sleep, adb server restart),
# so this is reapplied periodically instead of once at startup.
ADB_REVERSE_ENABLED = True
ADB_REVERSE_PORT = 8091
ADB_REVERSE_INTERVAL_S = 5
ADB_PATH = (
    shutil.which("adb")
    or os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
)

# WebSocket source — roadaware's direct sdsm-events relay (final confirmed
# URL, wss:// / TLS). Pre-demo-day test path: run this over VPN, same as
# before, just against the new host/path instead of cuip-api.research.utc.edu:8090.
CUIP_WS_URL = "wss://roadaware.cuip.research.utc.edu/ws/sdsm-events"

# Redis source (only used when SOURCE="redis")
REDIS_HOST = "roadaware.cuip.research.utc.edu"
REDIS_PORT = 6379
REDIS_PASSWORD = None          # set if auth is required
REDIS_CHANNEL = "sdsm-events"  # pub/sub channel name

# Local server
LOCAL_HOST = "0.0.0.0"
LOCAL_PORT = 8091

# ── State ─────────────────────────────────────────────────────────────────────

connected_clients: set = set()


# ── Local WebSocket server ────────────────────────────────────────────────────

async def local_ws_handler(websocket, path=None):
    global connected_clients
    print(f"[Bridge] App connected:    {websocket.remote_address}")
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[Bridge] App disconnected: {websocket.remote_address}")


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


# ── WebSocket source ──────────────────────────────────────────────────────────

async def cuip_ws_reader(queue: asyncio.Queue):
    while True:
        try:
            print(f"[Bridge] Connecting to CUIP WS → {CUIP_WS_URL}")
            async with websockets.connect(CUIP_WS_URL) as ws:
                print("[Bridge] CUIP WS connected — streaming SDSM data")
                async for raw in ws:
                    await queue.put(raw)
        except Exception as e:
            print(f"[Bridge] CUIP WS error: {e}. Retrying in 3s...")
            await asyncio.sleep(3)


# ── Redis source ──────────────────────────────────────────────────────────────

async def redis_reader(queue: asyncio.Queue):
    try:
        import redis.asyncio as aioredis
    except ImportError:
        print("[Bridge] ERROR: 'redis' package not installed. Run: pip install redis")
        return

    while True:
        try:
            print(f"[Bridge] Connecting to Redis → {REDIS_HOST}:{REDIS_PORT}")
            client = aioredis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True,
            )
            pubsub = client.pubsub()
            await pubsub.subscribe(REDIS_CHANNEL)
            print(f"[Bridge] Redis subscribed to '{REDIS_CHANNEL}'")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await queue.put(message["data"])
        except Exception as e:
            print(f"[Bridge] Redis error: {e}. Retrying in 3s...")
            await asyncio.sleep(3)


# ── adb reverse keeper (physical device over USB) ─────────────────────────────

async def adb_reverse_loop():
    if not ADB_REVERSE_ENABLED:
        return
    if not ADB_PATH or not os.path.exists(ADB_PATH):
        print(f"[Bridge] adb not found (looked at: {ADB_PATH}). Skipping adb reverse keeper.")
        return

    was_up = False
    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                ADB_PATH, "reverse", f"tcp:{ADB_REVERSE_PORT}", f"tcp:{ADB_REVERSE_PORT}",
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            up_now = proc.returncode == 0
            if up_now and not was_up:
                print(f"[Bridge] adb reverse tcp:{ADB_REVERSE_PORT} tcp:{ADB_REVERSE_PORT} — device attached")
            elif not up_now and was_up:
                print(f"[Bridge] adb reverse lost ({stderr.decode().strip()}). Will retry.")
            was_up = up_now
        except Exception as e:
            if was_up:
                print(f"[Bridge] adb reverse keeper error: {e}")
            was_up = False
        await asyncio.sleep(ADB_REVERSE_INTERVAL_S)


# ── Queue → broadcast loop ────────────────────────────────────────────────────

async def broadcast_loop(queue: asyncio.Queue):
    msg_count = 0
    while True:
        raw = await queue.get()
        msg_count += 1
        if msg_count <= 3:
            try:
                preview = list(json.loads(raw).keys())
                print(f"[Bridge] Message #{msg_count} keys: {preview}")
            except Exception:
                pass
        await broadcast(raw)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    queue: asyncio.Queue = asyncio.Queue()

    print(f"[Bridge] Source mode:  {SOURCE}")
    print(f"[Bridge] Listening on: ws://0.0.0.0:{LOCAL_PORT}")
    print(f"[Bridge] Emulator URL: ws://10.0.2.2:{LOCAL_PORT}")
    print(f"[Bridge] Physical dev: ws://<your-LAN-IP>:{LOCAL_PORT}")
    print()

    server = await websockets.serve(local_ws_handler, LOCAL_HOST, LOCAL_PORT)

    reader = cuip_ws_reader if SOURCE == "websocket" else redis_reader

    await asyncio.gather(
        server.wait_closed(),
        broadcast_loop(queue),
        reader(queue),
        adb_reverse_loop(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Bridge] Stopped.")
