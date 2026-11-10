import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { clearQueryCache } from '@/api/queryClient';
import type { ProfileResponse } from '@/features/profile/types';
import { unregisterThisDevice } from '@/features/push/notifications';
import { decodePharmacyToken, isTokenExpired } from '@/lib/jwt';

import * as authApi from './api';
import { AUTH_FAILED_MESSAGE, SESSION_EXPIRED_MESSAGE, SESSION_REVOKED_MESSAGE } from './messages';
import type { LoginResponse, SessionPharmacy, SessionUser } from './types';

const TOKEN_KEY = 'manzu.pharmacyToken';
const REFRESH_TOKEN_KEY = 'manzu.pharmacyRefreshToken';
const SESSION_KEY = 'manzu.session';
/** Logout must never hang on a slow network while unregistering the push token or revoking the chain. */
const LOGOUT_TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
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
  refreshToken: string | null;
  expiresAt: number | null;
  user: SessionUser | null;
  pharmacy: SessionPharmacy | null;
  /** One-shot message shown on the login screen (e.g. session expired). */
  authMessage: string | null;
  hydrate: () => Promise<void>;
  signIn: (response: LoginResponse) => Promise<void>;
  applyProfile: (profile: ProfileResponse) => Promise<void>;
  signOut: (message?: string) => Promise<void>;
  /**
   * Attempts to trade the stored refresh token for a new access + refresh pair.
   * Single-flight: concurrent callers share one in-flight request.
   * Returns the new access token on success, or null on failure (state may transition to signedOut).
   */
  refreshSession: () => Promise<string | null>;
  consumeAuthMessage: () => string | null;
}

async function persistSession(session: StoredSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), secureOptions);
}

async function wipeSecureStorage() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY, secureOptions),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureOptions),
    SecureStore.deleteItemAsync(SESSION_KEY, secureOptions),
  ]);
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

function toSessionUser(u: { id: number; name: string; email: string; role: SessionUser['role'] }): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function toSessionPharmacy(p: { id: number; name: string; status?: SessionPharmacy['status']; isActive?: boolean; logoUrl?: string | null }): SessionPharmacy {
  return { id: p.id, name: p.name, status: p.status, isActive: p.isActive, logoUrl: p.logoUrl };
}

const signedOutState = {
  status: 'signedOut' as const,
  token: null,
  refreshToken: null,
  expiresAt: null,
  user: null,
  pharmacy: null,
};

// Single-flight refresh: concurrent callers share the same in-flight promise.
let inFlightRefresh: Promise<string | null> | null = null;

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  token: null,
  refreshToken: null,
  expiresAt: null,
  user: null,
  pharmacy: null,
  authMessage: null,

  hydrate: async () => {
    try {
      const [token, refreshToken, rawSession] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY, secureOptions),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureOptions),
        SecureStore.getItemAsync(SESSION_KEY, secureOptions),
      ]);

      if (!token || !refreshToken) {
        if (token || refreshToken) await wipeSecureStorage();
        await clearQueryCache();
        set(signedOutState);
        return;
      }

      const payload = decodePharmacyToken(token);
      const stored = readStoredSession(rawSession);

      // Access token missing/expired but refresh token present: try to refresh silently.
      if (!payload || isTokenExpired(payload)) {
        const newAccess = await get().refreshSession();
        if (!newAccess) return; // refreshSession already set signedOut + message
        const newPayload = decodePharmacyToken(newAccess);
        if (!newPayload) {
          await wipeSecureStorage();
          set({ ...signedOutState, authMessage: AUTH_FAILED_MESSAGE });
          return;
        }
        set({
          status: 'signedIn',
          token: newAccess,
          expiresAt: newPayload.exp ? newPayload.exp * 1000 : null,
          user: stored?.user ?? toSessionUser({ id: newPayload.userId, name: '', email: '', role: newPayload.role as SessionUser['role'] }),
          pharmacy: stored?.pharmacy ?? { id: newPayload.pharmacyId, name: '' },
        });
        return;
      }

      set({
        status: 'signedIn',
        token,
        refreshToken,
        expiresAt: payload.exp ? payload.exp * 1000 : null,
        user: stored?.user ?? toSessionUser({ id: payload.userId, name: '', email: '', role: payload.role as SessionUser['role'] }),
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
      user: toSessionUser(response.user),
      pharmacy: toSessionPharmacy(response.pharmacy),
    };
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, response.token, secureOptions),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken, secureOptions),
      persistSession(session),
    ]);
    set({
      status: 'signedIn',
      token: response.token,
      refreshToken: response.refreshToken,
      expiresAt: payload.exp ? payload.exp * 1000 : null,
      user: session.user,
      pharmacy: session.pharmacy,
      authMessage: null,
    });
  },

  applyProfile: async ({ user, pharmacy }) => {
    if (get().status !== 'signedIn') return;
    const session: StoredSession = {
      user: toSessionUser(user),
      pharmacy: toSessionPharmacy(pharmacy),
    };
    set(session);
    await persistSession(session);
  },

  refreshSession: async () => {
    if (inFlightRefresh) return inFlightRefresh;

    const currentRefresh = get().refreshToken;
    if (!currentRefresh) {
      // No refresh token available: sign out.
      await get().signOut(SESSION_REVOKED_MESSAGE);
      return null;
    }

    inFlightRefresh = (async (): Promise<string | null> => {
      try {
        const result = await authApi.refreshToken({ refreshToken: currentRefresh });
        const payload = decodePharmacyToken(result.token);
        if (!payload) {
          await get().signOut(AUTH_FAILED_MESSAGE);
          return null;
        }
        const session: StoredSession = {
          user: toSessionUser(result.user),
          pharmacy: toSessionPharmacy(result.pharmacy),
        };
        await Promise.all([
          SecureStore.setItemAsync(TOKEN_KEY, result.token, secureOptions),
          SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken, secureOptions),
          persistSession(session),
        ]);
        set({
          status: 'signedIn',
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: payload.exp ? payload.exp * 1000 : null,
          user: session.user,
          pharmacy: session.pharmacy,
        });
        return result.token;
      } catch (err) {
        const apiErr = err as { code?: string; status?: number; isNetwork?: boolean };
        // Network / timeout: do not sign out. Let the next request retry.
        if (apiErr.isNetwork || apiErr.status === 0) {
          return null;
        }
        // Auth failure: refresh chain is dead → sign out.
        if (apiErr.status === 401) {
          const msg =
            apiErr.code === 'REFRESH_TOKEN_REUSED' || apiErr.code === 'INVALID_REFRESH_TOKEN' || apiErr.code === 'REFRESH_TOKEN_EXPIRED'
              ? SESSION_REVOKED_MESSAGE
              : SESSION_EXPIRED_MESSAGE;
          await get().signOut(msg);
          return null;
        }
        // Anything else (500, etc.): do not sign out; caller decides.
        return null;
      } finally {
        inFlightRefresh = null;
      }
    })();

    return inFlightRefresh;
  },

  signOut: async (message) => {
    if (get().status === 'signedOut' && !message) return;
    const currentRefresh = get().refreshToken;
    const wasSignedIn = get().status === 'signedIn';
    // Best-effort network cleanup before we clear state. Skipped when `message` is set
    // (forced sign-out because the session is already dead: those calls would 401).
    if (!message && wasSignedIn) {
      await withTimeout(
        (async () => {
          try { await unregisterThisDevice(); } catch { /* best effort */ }
          if (currentRefresh) {
            try { await authApi.logout({ refreshToken: currentRefresh }); } catch { /* best effort */ }
          }
        })(),
        LOGOUT_TIMEOUT_MS,
      );
    }
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

/** Called by the API client when a request returns 401. Attempts refresh, then signs out if it fails. */
export async function handleUnauthorizedRefresh(): Promise<boolean> {
  const newToken = await useSession.getState().refreshSession();
  return !!newToken;
}