import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { profileQueryOptions } from '@/features/profile/api';
import { isManager } from '@/lib/roles';

import { getMe, login, register } from './api';
import { useRole, useSession } from './store';
import type { LoginRequest, RegisterRequest } from './types';

export function useLogin() {
  const signIn = useSession((s) => s.signIn);
  return useMutation({
    mutationFn: (values: LoginRequest) => login(values),
    onSuccess: (data) => signIn(data),
  });
}

/** Registration returns a session token for the new MANAGER, so the user lands signed in. */
export function useRegister() {
  const signIn = useSession((s) => s.signIn);
  return useMutation({
    mutationFn: (values: RegisterRequest) => register(values),
    onSuccess: (data) => signIn(data),
  });
}

/**
 * Validates the stored session on launch / foreground via GET /api/auth/me (G1).
 * The refresh flow handles expired access tokens automatically; if refresh fails, the
 * store transitions to signedOut with a message and the router guard switches to (auth).
 * Also re-applies the profile data via the profile query (unchanged behaviour for the UI).
 */
export function useSessionValidation() {
  const status = useSession((s) => s.status);
  const applyProfile = useSession((s) => s.applyProfile);

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => getMe(),
    enabled: status === 'signedIn',
    staleTime: 60_000,
    retry: 1,
  });

  // Keep the profile cache warm too: many screens read `profileQueryOptions` for pharmacy extras
  // (operating hours, licenseNumber, etc.). /me is smaller and refreshes the session-critical fields.
  const profile = useQuery({
    ...profileQueryOptions,
    enabled: status === 'signedIn',
  });

  useEffect(() => {
    if (profile.data) void applyProfile(profile.data);
  }, [profile.data, applyProfile]);

  return { me, profile };
}

export function useIsManager(): boolean {
  return isManager(useRole());
}