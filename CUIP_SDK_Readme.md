# 🛰️ CUIP Python Data SDK

This SDK provides researchers and developers with easy access to CUIP's real-time data streams from the MLK Smart Corridor and other instrumented intersections in Chattanooga.

---

## 📦 Installation
If you have the distributed wheel file:
```bash
pip install cuip_sdk-2.0.3-py3-none-any.whl
```


---

## 🔑 Authentication

You will need a **CUIP API key** to access the data streams.

Set your key as an environment variable (recommended):
```bash
export CUIP_API_KEY="your_api_key_here"
```

Or pass it directly into the SDK when initializing a stream. (Given on the Sample script below)

---

## 🚀 Quick Start Example

```python
import cuip
import asyncio

def process(data):
    print(data)

asyncio.run(
    cuip.Streams("LMoMUMXbL5xfyUWNtR3ip").process_ws_stream(
        process, "sdsm-events"
    )
)
```

This example connects to CUIP’s **SDSM stream** and prints incoming messages in real time.

---

## 📡 Available Streams

| Stream ID              | Description                              |
|-------------------------|------------------------------------------|
| `spat-events`           | Signal phase and timing (SPaT) data      |
| `sdsm-events`           | Detected objects and trajectories        |
| `bsm-events`            | Basic safety messages                    |
| `srm-events` / `ssm-events` | Service request / status messages     |
| `all-lidars-events`     | Combined lidar data stream               |
| `georgia-lidar-events`  | Georgia intersection lidar feed          |
| `gs-realtime-zone`      | GridSmart zone-level real-time analytics |

For the lidar-events, spat-events, sdsm-events, you should expect to see high frequency messages. No wait times.  
For gs-realtime-zone, they come every minute.  
srm, ssm, bsm, they don't get sent unless there's a trigger.

---


## ⚙️ Troubleshooting

The CUIP SDK includes built-in error handling modules for common connection and runtime issues.  
Below are typical scenarios and how they are managed internally.

| Issue | Cause | Resolution |
|-------|--------|------------|
| **403 Forbidden** | The API key provided is invalid or missing. | Ensure your CUIP API key is valid. When unauthorized access occurs, the SDK automatically triggers `_handle_unauthorized()` to display a message and terminate safely. |
| **Invalid Stream ID** | The `stream_id` parameter does not match any supported data channel. | Use one of the valid stream identifiers: `spat-events`, `sdsm-events`, `bsm-events`, `srm-events`, `ssm-events`, `all-lidars-events`, `georgia-lidar-events`, `gs-realtime-zone`. |
| **Connection Failure (OSError / InvalidStatusCode)** | The SDK cannot reach `ws://cuip-api.research.utc.edu` — usually due to VPN disconnection or an unreachable host. | Ensure your VPN connection to CUIP resources is active and that outbound WebSocket ports (8080–8090) are open. When this happens, `_handle_connection_error()` is triggered. |
| **Connection Closed Mid-Stream** | The WebSocket server closed the connection unexpectedly. | The SDK logs a warning, then invokes `_handle_connection_error()` so you can safely restart your listener. |
| **KeyboardInterrupt (Ctrl + C)** | The user manually stopped the stream. | No action required. The SDK handles this via `_handle_keyboard_interrupt()` and exits gracefully. |
| **Message Processing Error / JSON Decode Error** | A malformed or unexpected message was received from the WebSocket stream. | The SDK logs the error and continues listening. You can add logic in your callback (`cb`) to skip or handle bad messages gracefully. |
| **Idle Stream (No Data for Several Minutes)** | Some streams (e.g., SPaT or GridSmart) naturally have quiet periods or event-driven updates. | The SDK prints a `[Notice]` message after three minutes of inactivity, but keeps the connection alive. No user action is needed unless data remains absent for an unusually long period. |

---

## 🧠 About CUIP

The **Center for Urban Informatics and Progress (CUIP)** at the University of Tennessee at Chattanooga operates the **MLK Smart Corridor**—a living urban testbed for intelligent transportation and smart-city research.

Learn more: [https://www.utc.edu/research/center-urban-informatics-and-progress]
