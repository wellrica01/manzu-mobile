import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { configureApiClient } from '@/api/client';
import { bindReactQueryNativeListeners, persistOptions, queryClient } from '@/api/queryClient';
import { toastConfig } from '@/components/toast/toastConfig';
import { useSession } from '@/features/auth/store';
import { configureNotificationHandler } from '@/features/push/notifications';

void SplashScreen.preventAutoHideAsync();
bindReactQueryNativeListeners();
configureNotificationHandler();
configureApiClient({
  getToken: () => useSession.getState().token,
  onUnauthorized: () => useSession.getState().refreshSession().then((t) => !!t),
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const status = useSession((s) => s.status);
  const ready = (fontsLoaded || !!fontError) && status !== 'loading';

  useEffect(() => {
    void useSession.getState().hydrate();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = status === 'signedIn';
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
        <Toast config={toastConfig} topOffset={56} />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}