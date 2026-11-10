import { apiRequest } from '@/api/client';

import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  MeResponse,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from './types';

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  // Same sanitising as manzu-f pharmacyAuthAPI.login.
  const body: LoginRequest = {
    email: String(credentials.email).trim().toLowerCase().slice(0, 200),
    pin: String(credentials.pin).trim(),
  };
  return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body, auth: false });
}

export function register(body: RegisterRequest): Promise<RegisterResponse> {
  const user = { ...body.user, email: body.user.email.trim().toLowerCase() };
  return apiRequest<RegisterResponse>('/api/auth/register', { method: 'POST', body: { ...body, user }, auth: false });
}

/** G2: rotates the refresh token. `auth: false` — must not carry the (possibly expired) access token. */
export function refreshToken(body: RefreshRequest): Promise<RefreshResponse> {
  return apiRequest<RefreshResponse>('/api/auth/refresh', { method: 'POST', body, auth: false });
}

/** G2: revokes the login chain. Idempotent, so a stale token is fine. */
export function logout(body: LogoutRequest): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST', body, auth: false });
}

/** G1: who am I, straight from the database. Role and pharmacy status are read fresh. */
export function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/auth/me');
}