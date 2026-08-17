module.exports = {
  expo: {
    name: 'V2X Connect',
    slug: 'v2xmobile',
    scheme: 'v2xmobile',
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location.',
        },
      ],
      'expo-sqlite',
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_SECRET_TOKEN || '',
        },
      ],
    ],
    assetBundlePatterns: [
      'assets/database/*',
      'assets/data/*',
    ],
    extra: {
      eas: {
        projectId: '3ba8fe24-aaaa-4d1f-a84c-5901cc670a86',
      },
    },
    android: {
      package: 'com.yosifmohamedain.mapboxapp',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'INTERNET',
        'ACCESS_NETWORK_STATE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    ios: {
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'This app needs access to your location to show it on the map.',
      },
      bundleIdentifier: 'com.yosifmohamedain.mapboxapp',
    },
  },
};
