import { Alert, Platform } from 'react-native';

export const showDebugAlert = (title: string, message: string) => {
  Alert.alert(
    `DEBUG: ${title}`,
    message,
    [{ text: 'OK' }],
    { cancelable: false }
  );
};

export const checkServerConnection = async (url: string): Promise<boolean> => {
  try {

    // Set a timeout for the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    return false;
  }
};

export default showDebugAlert;