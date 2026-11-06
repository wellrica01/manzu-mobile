import { apiRequest } from '@/api/client';

export type PushPlatform = 'ios' | 'android';

/** G4: one row per device on the backend (PushToken). Registering the same token again just refreshes it. */
export function registerPushToken(token: string, platform: PushPlatform): Promise<{ message: string }> {
  return apiRequest('/api/pharmacy/push-tokens', { method: 'POST', body: { token, platform } });
}

/** Expo tokens contain `[` and `]`, so the token must be URL-encoded in the path. Idempotent on the server. */
export function unregisterPushToken(token: string): Promise<{ message: string }> {
  return apiRequest(`/api/pharmacy/push-tokens/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
