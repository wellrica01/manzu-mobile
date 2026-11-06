import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { clearQueryCache } from '@/api/queryClient';
import type { ProfileResponse } from '@/features/profile/types';
import { unregisterThisDevice } from '@/features/push/notifications';
import { decodePharmacyToken, isTokenExpired } from '@/lib/jwt';

import { SESSION_EXPIRED_MESSAGE } from './messages';
import type { LoginResponse, SessionPharmacy, SessionUser } from './types';

const TOKEN_KEY = 'manzu.pharmacyToken';
const SESSION_KEY = 'manzu.session';
/** Logout must never hang on a slow network while unregistering the push token. */
const PUSH_UNREGISTER_TIMEOUT_MS = 3000;

async function unregisterPushQuietly(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS);
  });
  try {
    await Promise.race([unregisterThisDevice(), timeout]);
  } catch {
    // Best effort: the backend also drops tokens that Expo reports as unregistered.
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const secureOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

type Status = 'loading' | 'signedOut' | 'signedIn';

interface StoredSession {
  user: SessionUser;
  pharmacy: SessionPharmacy;
}

interface SessionState {
  status: Status;
  token: string | null;
  expiresAt: number | null;
  user: SessionUser | null;
  pharmacy: SessionPharmacy | null;
  /** One-shot message shown on the login screen (e.g. session expired). */
  authMessage: string | null;
  hydrate: () => Promise<void>;
  signIn: (response: LoginResponse) => Promise<void>;
  applyProfile: (profile: ProfileResponse) => Promise<void>;
  signOut: (message?: string) => Promise<void>;
  consumeAuthMessage: () => string | null;
}

async function persistSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), secureOptions);
}

async function wipeSecureStorage() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY, secureOptions), SecureStore.deleteItemAsync(SESSION_KEY, secureOptions)]);
}

function readStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.user && parsed?.pharmacy ? parsed : null;
  } catch {
    return null;
  }
}

const signedOutState = { status: 'signedOut' as const, token: null, expiresAt: null, user: null, pharmacy: null };

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  token: null,
  expiresAt: null,
  user: null,
  pharmacy: null,
  authMessage: null,

  hydrate: async () => {
    try {
      const [token, rawSession] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY, secureOptions),
        SecureStore.getItemAsync(SESSION_KEY, secureOptions),
      ]);
      const payload = token ? decodePharmacyToken(token) : null;
      if (!token || !payload) {
        if (token) await wipeSecureStorage();
        await clearQueryCache();
        set(signedOutState);
        return;
      }
      if (isTokenExpired(payload)) {
        await wipeSecureStorage();
        await clearQueryCache();
        set({ ...signedOutState, authMessage: SESSION_EXPIRED_MESSAGE });
        return;
      }
      const stored = readStoredSession(rawSession);
      set({
        status: 'signedIn',
        token,
        expiresAt: payload.exp ? payload.exp * 1000 : null,
        user: stored?.user ?? { id: payload.userId, name: '', email: '', role: payload.role as SessionUser['role'] },
        pharmacy: stored?.pharmacy ?? { id: payload.pharmacyId, name: '' },
      });
    } catch {
      set(signedOutState);
    }
  },

  signIn: async (response) => {
    const payload = decodePharmacyToken(response.token);
    if (!payload) throw new Error('Received an invalid session token. Please try again.');
    await clearQueryCache();
    const session: StoredSession = {
      user: { id: response.user.id, name: response.user.name, email: response.user.email, role: response.user.role },
      pharmacy: { id: response.pharmacy.id, name: response.pharmacy.name },
    };
    await SecureStore.setItemAsync(TOKEN_KEY, response.token, secureOptions);
    await persistSession(session);
    set({
      status: 'signedIn',
      token: response.token,
      expiresAt: payload.exp ? payload.exp * 1000 : null,
      user: session.user,
      pharmacy: session.pharmacy,
      authMessage: null,
    });
  },

  applyProfile: async ({ user, pharmacy }) => {
    if (get().status !== 'signedIn') return;
    const session: StoredSession = {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      pharmacy: { id: pharmacy.id, name: pharmacy.name, status: pharmacy.status, isActive: pharmacy.isActive, logoUrl: pharmacy.logoUrl },
    };
    set(session);
    await persistSession(session);
  },

  signOut: async (message) => {
    if (get().status === 'signedOut' && !message) return;
    // User-initiated logout only: the session token is still valid, so ask the backend to stop pushing to this device.
    // Skipped when `message` is set (expired/invalid session): the request would 401 and re-enter signOut.
    if (!message && get().status === 'signedIn') await unregisterPushQuietly();
    set({ ...signedOutState, authMessage: message ?? null });
    await Promise.allSettled([wipeSecureStorage(), clearQueryCache()]);
  },

  consumeAuthMessage: () => {
    const message = get().authMessage;
    if (message) set({ authMessage: null });
    return message;
  },
}));

export const useRole = () => useSession((s) => s.user?.role ?? null);
