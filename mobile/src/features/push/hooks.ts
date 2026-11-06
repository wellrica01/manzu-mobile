import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/store';
import { dashboardKeys } from '@/features/dashboard/api';
import { orderKeys } from '@/features/orders/api';
import { PUSH_ENABLED } from '@/lib/flags';

import { getPushPermission, hrefForNotification, pushAvailability, registerForPush, type PushAvailability, type PushPermission } from './notifications';

/** Registers this device once per signed-in user per launch (the backend keeps one row per device, so every signed-in device gets pushes). */
export function usePushRegistration() {
  const userId = useSession((s) => s.user?.id);
  const registeredFor = useRef<number | null>(null);

  useEffect(() => {
    // Signed out: forget who we registered, so signing back in as the same user registers again.
    if (!userId) {
      registeredFor.current = null;
      return;
    }
    if (registeredFor.current === userId || pushAvailability() !== 'available') return;
    registeredFor.current = userId;
    registerForPush({ prompt: true }).catch((e: unknown) => {
      registeredFor.current = null;
      if (__DEV__) console.warn('Push registration failed', e);
    });
  }, [userId]);
}

/** Opens the order from a tapped notification (cold start included) and refreshes order data when one arrives. */
export function useNotificationObserver() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!PUSH_ENABLED) return;
    const open = (notification: Notifications.Notification) => {
      const href = hrefForNotification(notification.request.content.data);
      if (href) router.push(href);
    };

    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last.notification);
      Notifications.clearLastNotificationResponse();
    }
    const responses = Notifications.addNotificationResponseReceivedListener((response) => {
      open(response.notification);
      Notifications.clearLastNotificationResponse();
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    });
    return () => {
      responses.remove();
      received.remove();
    };
  }, [router, queryClient]);
}

/** Current availability + permission for the More screen row; refreshed when the app returns to the foreground. */
export function usePushStatus() {
  const [availability] = useState<PushAvailability>(pushAvailability);
  const [permission, setPermission] = useState<PushPermission | null>(null);

  useEffect(() => {
    if (availability !== 'available') return;
    let active = true;
    const load = () =>
      void getPushPermission().then((p) => {
        if (active) setPermission(p);
      });
    load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [availability]);

  const enable = useCallback(async () => {
    const ok = await registerForPush({ prompt: true });
    setPermission(await getPushPermission());
    return ok;
  }, []);

  return { availability, permission, enable };
}
