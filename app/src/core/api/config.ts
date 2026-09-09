export const API_CONFIG = {

  // Set GOOGLE_MAPS_API_KEY in your .env file or environment
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  // Direct public relay — confirmed reachable on cellular data without VPN,
  // same host sdsm_bridge.py's own CUIP_WS_URL now points at. No local-bridge
  // fallback branch: sdsm_bridge.py + adb reverse is no longer needed to run
  // the app at all, only if this relay itself ever goes down.
  SDSM_WS_URL: 'wss://roadaware.cuip.research.utc.edu/ws/sdsm-events',

  // Direct public relay for spat-events (all ~13 corridor intersections, not
  // just Georgia/Houston) — bypasses spat_bridge.py entirely. Unused: SPaT
  // isn't wired into this project (see SPAT_WS_ENABLED below).
  SPAT_WS_URL: 'wss://roadaware.cuip.research.utc.edu/ws/spat-events',
  // SPaT isn't used by this project — disabled to stop SpatWebSocketService
  // from attempting connections at all and spamming "[SpatWS] Connection
  // error" reconnect-loop logs. The app degrades to "SPaT unavailable"
  // everywhere, which is fine since nothing reads it.
  SPAT_WS_ENABLED: false,

  // Dashboard backend (SPaT zones authored in Kepler dashboard). Critical
  // path for preemption: zone/geofence configs come from here, so if this is
  // unreachable, preemption never triggers regardless of SPaT/SDSM status.
  // Public host from the dashboard migration — reachable on data without
  // VPN. No trailing slash — every call site appends `/api/...` directly
  // onto this.
  DASHBOARD_API_URL: 'https://roadaware.cuip.research.utc.edu/dashboard-api',

  // LOCAL DOCKER (dev testing): 10.0.2.2 only resolves inside the Android
  // emulator — a physical device needs the host machine's actual LAN IP,
  // same as SPAT_WS_URL/SDSM_WS_URL above.
  // PREEMPTION_API_URL: 'http://10.0.2.2:8001', // emulator only
  // PREEMPTION_API_URL: 'http://192.168.40.142:8001', //physical device only
  // PRODUCTION VM (roadaware, over CUIP network):
  // http:// silently gets 302'd to https:// server-side, and fetch downgrades
  // a redirected POST to GET per spec — that turned every /preempt/start call
  // into a GET, which the API correctly rejects with 405 Method Not Allowed.
  // Pointing straight at https avoids the redirect (and the method loss).
  PREEMPTION_API_URL: 'https://roadaware.cuip.research.utc.edu/preemptapi',
  PREEMPTION_HOST: 'roadaware.cuip.research.utc.edu',

  // N-V2X SRM ingest (Kafka-backed) — confirmed with the dashboard team,
  // 2026-09. Tags each preemption request with position + vehicle type so
  // the Kepler dashboard's Demo Day map/timeline can show it. Routed
  // through the same public VM as PREEMPTION_API_URL/DASHBOARD_API_URL.
  NV2X_SRM_INGEST_URL: 'https://roadaware.cuip.research.utc.edu/nv2x-srm/api/v1/srm',
  // TODO: make this configurable if the app ever supports non-emergency
  // preemption vehicles — hardcoded for now since this app is EV-only today.
  NV2X_VEHICLE_TYPE: 'emergency',
};
