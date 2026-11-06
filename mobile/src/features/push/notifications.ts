import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type { Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PUSH_ENABLED } from '@/lib/flags';
import { colors } from '@/theme';

import { registerPushToken, unregisterPushToken } from './api';

export const ORDERS_CHANNEL_ID = 'orders';

export type PushAvailability = 'disabled' | 'unsupported' | 'expo-go' | 'no-project' | 'available';

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Remote push needs a real device, a development/production build on Android (not Expo Go, SDK 53+) and an EAS projectId. */
export function pushAvailability(): PushAvailability {
  if (!PUSH_ENABLED) return 'disabled';
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  if (!easProjectId()) return 'no-project';
  return 'available';
}

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (!PUSH_ENABLED || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: () => Promise.resolve({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Android 13+ only shows the permission prompt once a channel exists.
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, {
    name: 'Orders',
    // AndroidImportance is re-exported via `export *` from a .types file, which eslint-plugin-import can't follow.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.primary,
  });
}

/** The token this launch registered with the backend, kept so logout can unregister exactly this device. */
let registeredPushToken: string | null = null;

export interface PushPermission {
  granted: boolean;
  canAskAgain: boolean;
}

export async function getPushPermission(): Promise<PushPermission> {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

/**
 * Gets an Expo push token and registers this device with the backend (G4, one row per device).
 * `prompt` asks for permission when it is still undetermined. Returns whether a token was registered.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<boolean> {
  if (pushAvailability() !== 'available') return false;
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && prompt) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId() });
  await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  registeredPushToken = token;
  return true;
}

/**
 * Tells the backend to stop pushing to this device (call on user-initiated logout, while the session token is still valid).
 * No-op when push is off. If this launch never registered, falls back to the device's own token when permission was granted.
 */
export async function unregisterThisDevice(): Promise<void> {
  let token = registeredPushToken;
  if (!token && pushAvailability() === 'available') {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId() })).data;
  }
  if (!token) return;
  await unregisterPushToken(token);
  registeredPushToken = null;
}

/**
 * Deep-link target for a tapped notification. The backend sender (G4) sends
 * `data: { type: 'order', orderId: number }` for new paid orders.
 */
export function hrefForNotification(data: Record<string, unknown> | undefined): Href | null {
  const raw = data?.orderId;
  const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (Number.isInteger(id) && id > 0) return { pathname: '/orders/[id]', params: { id: String(id) } };
  return data?.type === 'order' ? '/orders' : null;
}
