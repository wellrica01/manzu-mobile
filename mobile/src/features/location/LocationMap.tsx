import { Navigation } from 'lucide-react-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, Text } from '@/components/ui';
import { colors, radius } from '@/theme';

interface Props {
  latitude: number;
  longitude: number;
  title?: string;
  height?: number;
}

export function openInMaps(latitude: number, longitude: number, label = 'Pharmacy') {
  const q = `${latitude},${longitude}`;
  const url = Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(label)}` : `geo:${q}?q=${q}(${encodeURIComponent(label)})`;
  void Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`));
}

// Read-only preview using OpenStreetMap tiles (no Google Maps API key or billing).
// Renders a small Leaflet map inside a WebView with a marker at the given coordinates.
export function LocationMap({ latitude, longitude, title = 'Pharmacy', height = 180 }: Props) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body { margin: 0; padding: 0; }
  #map { width: 100vw; height: 100vh; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const lat = ${latitude};
  const lng = ${longitude};
  const map = L.map('map', { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false }).setView([lat, lng], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.circleMarker([lat, lng], {
    radius: 10,
    fillColor: '#1ABA7F',
    color: '#FFFFFF',
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  }).addTo(map).bindPopup(${JSON.stringify(title)});
</script>
</body>
</html>`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapClip, { height }]}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          accessibilityLabel={`Map showing ${title}`}
        />
      </View>
      <View style={styles.row}>
        <Text size="xs" color={colors.gray600} style={styles.flex}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
        <Button title="Open in Maps" size="sm" variant="outline" icon={Navigation} onPress={() => openInMaps(latitude, longitude, title)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 8 },
  mapClip: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: colors.gray100 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});