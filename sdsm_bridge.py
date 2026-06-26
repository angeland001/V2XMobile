"""
SDSM WebSocket Bridge
---------------------
Connects to CUIP data (requires VPN/network access from this machine) and
re-serves the stream as a local WebSocket so the Android emulator can reach it.

Two source modes (set SOURCE below):
  "websocket" - direct WebSocket to cuip-api.research.utc.edu:8090
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
import websockets

# ── Configuration ─────────────────────────────────────────────────────────────

SOURCE = "websocket"           # "websocket" | "redis"

# WebSocket source
CUIP_WS_URL = "ws://cuip-api.research.utc.edu:8090"

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
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Bridge] Stopped.")
