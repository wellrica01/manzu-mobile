import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const projectId = process.env.EAS_PROJECT_ID;

  const plugins: ExpoConfig['plugins'] = [...(config.plugins ?? [])].map((plugin) =>
    plugin === 'react-native-maps' && mapsKey ? ['react-native-maps', { androidGoogleMapsApiKey: mapsKey }] : plugin,
  );

  // Add expo-build-properties to fix R8 stripping WorkDatabase_Impl in release builds
  plugins.push([
    'expo-build-properties',
    {
      android: {
        extraProguardRules: [
          '-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }',
          '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
        ].join('\n'),
      },
    },
  ]);

  return {
    ...config,
    name: config.name ?? 'Manzu Pharmacy',
    slug: config.slug ?? 'manzu-pharmacy',
    plugins,
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
    android: {
      ...config.android,
      googleServicesFile: './google-services.json',
    },
  };
};