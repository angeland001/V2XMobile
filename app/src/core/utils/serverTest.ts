// src/core/utils/serverTest.ts
import { Alert, Platform } from 'react-native';
import { API_CONFIG } from '../api/config';

// Try multiple connection approaches to find what works
export const testServerConnection = async () => {

  // Define different server URLs to try
  const urlsToTest = [
    { name: 'Standard URL (10.0.2.2)', url: 'http://10.0.2.2:5000/' },
    { name: 'Localhost URL', url: 'http://localhost:5000/' },
    { name: 'IP Address URL', url: 'http://127.0.0.1:5000/' },
    // Try your computer's actual local network IP address (e.g., 192.168.1.X)
    { name: 'Local Network IP', url: 'http://192.168.1.100:5000/' } // Change this to your actual IP
  ];

  let successfulConnection = false;
  let successUrl = '';
  const results = [];

  // Test each URL
  for (const { name, url } of urlsToTest) {
    try {
      
      // Set a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const startTime = Date.now();
      const response = await fetch(url, { 
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'text/plain, application/json',
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      
      const responseStatus = `Status: ${response.status}`;
      const responseTime = `Time: ${endTime - startTime}ms`;
      
      
      if (response.ok) {
        successfulConnection = true;
        successUrl = url;
        results.push(`✅ ${name} - ${responseStatus}, ${responseTime}`);
      } else {
        results.push(`❌ ${name} - ${responseStatus}, ${responseTime}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push(`❌ ${name} - Error: ${errorMessage}`);
    }
  }

  // Show the results
  const resultsMessage = results.join('\n\n');
  
  if (successfulConnection) {
    Alert.alert(
      'Connection Test Results',
      `Found a working connection!\n\n${resultsMessage}\n\nUpdate your config to use: ${successUrl}`,
      [{ text: 'OK' }]
    );
    return { success: true, url: successUrl };
  } else {
    Alert.alert(
      'Connection Test Results',
      `No working connections found. Make sure your server is running.\n\n${resultsMessage}`,
      [{ text: 'OK' }]
    );
    return { success: false, url: '' };
  }
};

export default testServerConnection;