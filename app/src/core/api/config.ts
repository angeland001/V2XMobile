export const API_CONFIG = {

  // Set GOOGLE_MAPS_API_KEY in your .env file or environment
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  SERVER_URL: 'http://10.0.2.2:5000',
  API_URL: 'http://10.0.2.2:5000/api',

  REDIS_API_URL: 'http://roadaware.cuip.research.utc.edu/cv2x',
  REDIS_SDSM_ENDPOINT: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia',

  REDIS_MAP_ENDPOINT: 'http://10.199.1.11:9095/latest/map_events',

  // Dashboard backend (SPaT zones authored in Kepler dashboard)
  DASHBOARD_API_URL: 'http://10.199.1.41:3001'
};
