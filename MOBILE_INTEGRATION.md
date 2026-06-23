# Mobile App Integration Guide

## Workflow

### Toggle OFF
- If there is an active session, call `/preempt/clear`
- Stop heartbeats
- Delete local `session_id`

### Toggle ON
- Continuously check whether the vehicle is inside a preempt zone
- If the vehicle enters a zone and there is no active local `session_id`, call `/preempt/start`
- Save the returned `session_id`
- While still inside the zone, call `/preempt/heartbeat` every 1–2 seconds
- If the vehicle leaves the zone, call `/preempt/clear` and then delete local `session_id`

## Important rule

Do **not** repeatedly call `/preempt/start` while a valid session exists.
Use heartbeat until the vehicle leaves the zone or toggle is turned OFF.

## Start endpoint

**POST** `/preempt/start`

### Request
```json
{
  "srm_payload": {
    "value": [
      "SignalRequestMessage",
      {
        "requestor": {
          "id": ["stationID", 12345]
        },
        "requests": [
          {
            "request": {
              "inBoundLane": ["lane", 1],
              "signalGroup": 4
            }
          }
        ]
      }
    ]
  }
}
```

### Response
```json
{
  "ok": true,
  "detail": "Preempt started",
  "session_id": "f4f61bb8-a2b2-4d29-8f13-a4d5f5865e10",
  "controller_ip": "10.199.1.44",
  "preempt_channel": 4,
  "ssm": {
    "messageId": 30,
    "value": [
      "SignalStatusMessage",
      {
        "status": "granted",
        "stationID": 12345,
        "signalGroup": 4
      }
    ]
  }
}
```

Save `session_id` locally.

## Heartbeat endpoint

**POST** `/preempt/heartbeat`

Send every 1–2 seconds while:
- toggle is ON
- vehicle is still inside the preempt zone
- `session_id` exists

### Request
```json
{
  "session_id": "f4f61bb8-a2b2-4d29-8f13-a4d5f5865e10"
}
```

### Response
```json
{
  "ok": true,
  "detail": "Heartbeat accepted",
  "session_id": "f4f61bb8-a2b2-4d29-8f13-a4d5f5865e10",
  "controller_ip": "10.199.1.44",
  "preempt_channel": 4,
  "current_state": 6,
  "ssm": {
    "messageId": 30,
    "value": [
      "SignalStatusMessage",
      {
        "status": "granted",
        "stationID": 12345,
        "signalGroup": 4
      }
    ]
  }
}
```

## Clear endpoint

**POST** `/preempt/clear`

Call when:
- toggle changes to OFF
- or vehicle leaves the zone

### Request
```json
{
  "session_id": "f4f61bb8-a2b2-4d29-8f13-a4d5f5865e10"
}
```

### Response
```json
{
  "ok": true,
  "detail": "Preempt cleared",
  "session_id": "f4f61bb8-a2b2-4d29-8f13-a4d5f5865e10",
  "controller_ip": "10.199.1.44",
  "preempt_channel": 4,
  "ssm": {
    "messageId": 30,
    "value": [
      "SignalStatusMessage",
      {
        "status": "cancelled",
        "stationID": 12345,
        "signalGroup": 4
      }
    ]
  }
}
```

## Timeout behavior

If no heartbeat is sent for more than 5 seconds:
- backend automatically clears the preempt
- backend deletes the session

If the app later sends heartbeat for an expired session, backend returns 404.
In that case:
- delete local `session_id`
- if still inside the zone and toggle is still ON, call `/preempt/start` again

## Recommended local app state

Track these values:
- `toggle_enabled`
- `inside_preempt_zone`
- `session_id` (nullable)

Suggested logic:
- If toggle ON + inside zone + no session_id → `/preempt/start`
- If toggle ON + inside zone + session_id exists → `/preempt/heartbeat`
- If session_id exists + outside zone → `/preempt/clear`
- If session_id exists + toggle OFF → `/preempt/clear`
