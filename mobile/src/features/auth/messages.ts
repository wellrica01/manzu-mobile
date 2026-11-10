import type { ApiError } from '@/api/errors';

// Same copy as manzu-f handlePharmacyAuthError.
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';
export const AUTH_FAILED_MESSAGE = 'Authentication failed. Please log in again.';
export const SESSION_REVOKED_MESSAGE = 'Your session was ended for security reasons. Please log in again.';
export const SESSION_REFRESH_FAILED_MESSAGE = 'Your session could not be renewed. Please log in again.';

export function authMessageFor(error: ApiError): string {
  if (error.code === 'TOKEN_EXPIRED') return SESSION_EXPIRED_MESSAGE;
  if (error.code === 'REFRESH_TOKEN_REUSED' || error.code === 'INVALID_REFRESH_TOKEN' || error.code === 'REFRESH_TOKEN_EXPIRED') {
    return SESSION_REVOKED_MESSAGE;
  }
  if (error.code === 'USER_NOT_FOUND') return AUTH_FAILED_MESSAGE;
  return AUTH_FAILED_MESSAGE;
}