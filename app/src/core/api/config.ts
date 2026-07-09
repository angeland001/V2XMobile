export const API_CONFIG = {

  // Set GOOGLE_MAPS_API_KEY in your .env file or environment
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  SERVER_URL: 'http://10.0.2.2:5000',
  API_URL: 'http://10.0.2.2:5000/api',

  REDIS_API_URL: 'http://roadaware.cuip.research.utc.edu/cv2x',
  REDIS_SDSM_ENDPOINT: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia',
  // Bridge running on dev machine (emulator uses 10.0.2.2 to reach host).
  // For a physical device on the same LAN replace with your machine's IP.
  // For a device with VPN use: ws://cuip-api.research.utc.edu:8090
  SDSM_WS_URL: 'ws://10.0.2.2:8091',

  // spat_bridge.py — relays CUIP's spat-events stream (all ~13 corridor
  // intersections, not just Georgia/Houston). Same host-reachability notes as
  // SDSM_WS_URL above.
  SPAT_WS_URL: 'ws://10.0.2.2:8092',
  // Flip to false when the CUIP SDK/spat_bridge.py is down or unavailable, to
  // stop SpatWebSocketService from attempting connections and spamming
  // reconnect-error logs. The app degrades to "SPaT unavailable" everywhere.
  SPAT_WS_ENABLED: false,

  REDIS_MAP_ENDPOINT: 'http://10.199.1.11:9095/latest/map_events',

  // Dashboard backend (SPaT zones authored in Kepler dashboard)
  DASHBOARD_API_URL: 'http://10.199.1.41:3001',

  // Use direct IP to bypass emulator DNS; Host header is set explicitly in fetch calls
  PREEMPTION_API_URL: 'http://10.0.2.2:8001',
  PREEMPTION_HOST: 'roadaware.cuip.research.utc.edu',
};
