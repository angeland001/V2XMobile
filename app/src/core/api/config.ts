// Set EXPO_PUBLIC_FIELD_MODE=1 in your .env for testing on cellular data, off
// the CUIP lab LAN (e.g. the physical corridor/vehicle test). Swaps every
// LAN-only host below for its public/VPN-reachable equivalent. Endpoints
// marked NEEDS CONFIRMATION are still guesses at a hostname pattern — verify
// with whoever runs roadaware.cuip.research.utc.edu before relying on them
// in the field; a wrong host fails silently (unreachable/timeout), not loudly.
const FIELD_MODE = process.env.EXPO_PUBLIC_FIELD_MODE === '1';

if (FIELD_MODE) {
  console.warn(
    '[API_CONFIG] FIELD_MODE is on: SPAT_WS_URL and DASHBOARD_API_URL/REDIS_MAP_ENDPOINT ' +
      'are unconfirmed public hostnames (see config.ts). Confirm reachability before a field test.'
  );
}

export const API_CONFIG = {

  // Set GOOGLE_MAPS_API_KEY in your .env file or environment
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  SERVER_URL: 'http://10.129.244.3:5000',
  API_URL: 'http://10.129.244.3:5000/api',

  REDIS_API_URL: 'http://roadaware.cuip.research.utc.edu/cv2x',
  REDIS_SDSM_ENDPOINT: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia',
  // Bridge running on dev machine (emulator uses 10.0.2.2 to reach host).
  // For a physical device on the same LAN replace with your machine's IP.
  SDSM_WS_URL: FIELD_MODE
    ? 'ws://cuip-api.research.utc.edu:8090'
    : 'ws://10.129.244.3:8091',

  // spat_bridge.py — relays CUIP's spat-events stream (all ~13 corridor
  // intersections, not just Georgia/Houston). Same host-reachability notes as
  // SDSM_WS_URL above.
  // NEEDS CONFIRMATION: no known public/VPN host for spat_bridge.py yet —
  // this LAN address is used even in FIELD_MODE until one is confirmed.
  SPAT_WS_URL: 'ws://10.129.244.3:8092',
  // Flip to false when the CUIP SDK/spat_bridge.py is down or unavailable, to
  // stop SpatWebSocketService from attempting connections and spamming
  // reconnect-error logs. The app degrades to "SPaT unavailable" everywhere.
  SPAT_WS_ENABLED: true,

  // NEEDS CONFIRMATION: no known public/VPN host for the MAP-events relay yet.
  REDIS_MAP_ENDPOINT: 'http://10.199.1.11:9095/latest/map_events',

  // Dashboard backend (SPaT zones authored in Kepler dashboard). Critical
  // path for preemption: zone/geofence configs come from here, so if this is
  // unreachable, preemption never triggers regardless of SPaT/SDSM status.
  // NEEDS CONFIRMATION: no known public/VPN host for the dashboard API yet —
  // this LAN address is used even in FIELD_MODE until one is confirmed.
  DASHBOARD_API_URL: 'http://10.199.1.41:3001',

  // Already a public hostname — reachable over cellular in both modes.
  PREEMPTION_API_URL: 'http://roadaware.cuip.research.utc.edu/preemptapi',
  PREEMPTION_HOST: 'roadaware.cuip.research.utc.edu',
};
