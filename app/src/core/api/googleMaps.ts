import { API_CONFIG } from './config';

export const initGoogleMaps = () => {
  if (!API_CONFIG.GOOGLE_MAPS_API_KEY) {
    console.warn('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Google Maps tiles may not load.');
  }
};

export default initGoogleMaps;
