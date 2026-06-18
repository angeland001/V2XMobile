import { useState, useEffect } from 'react';
import { LocationService } from '../../features/Map/services/LocationService';

export const useLocationPermission = (): [boolean, boolean] => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const permission = await LocationService.requestPermission();
        setHasPermission(permission);
      } catch (error) {
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, []);

  return [hasPermission, isLoading];
};

export default useLocationPermission;