import type { ConfigContext, ExpoConfig } from 'expo/config';

// Build-time values from the environment (EAS env vars or local .env); never commit keys.
// GOOGLE_MAPS_API_KEY: Android (and iOS Google provider) maps in standalone builds. EAS_PROJECT_ID: push tokens + EAS.
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const projectId = process.env.EAS_PROJECT_ID;
  const plugins = (config.plugins ?? []).map((plugin) => (plugin === 'react-native-maps' && mapsKey ? ['react-native-maps', { androidGoogleMapsApiKey: mapsKey }] : plugin)) as ExpoConfig['plugins'];
  return {
    ...config,
    name: config.name ?? 'Manzu Pharmacy',
    slug: config.slug ?? 'manzu-pharmacy',
    plugins,
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
    android: {
    ...config.android,
    googleServicesFile: './google-services.json', // Add this line
  },
  };
};
