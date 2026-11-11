import {
  AUTH_FAILED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  SESSION_REFRESH_FAILED_MESSAGE,
  SESSION_REVOKED_MESSAGE,
  authMessageFor,
} from '@/features/auth/messages';
import { ApiError } from '@/api/errors';

function err(code: string): ApiError {
  return new ApiError('msg', 401, code);
}

describe('message constants', () => {
  test('all four are distinct non-empty strings', () => {
    const all = [SESSION_EXPIRED_MESSAGE, AUTH_FAILED_MESSAGE, SESSION_REVOKED_MESSAGE, SESSION_REFRESH_FAILED_MESSAGE];
    all.forEach((m) => {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    });
    expect(new Set(all).size).toBe(4);
  });
});

describe('authMessageFor', () => {
  test('TOKEN_EXPIRED → session expired', () => {
    expect(authMessageFor(err('TOKEN_EXPIRED'))).toBe(SESSION_EXPIRED_MESSAGE);
  });

  test('REFRESH_TOKEN_REUSED → session revoked', () => {
    expect(authMessageFor(err('REFRESH_TOKEN_REUSED'))).toBe(SESSION_REVOKED_MESSAGE);
  });

  test('INVALID_REFRESH_TOKEN → session revoked', () => {
    expect(authMessageFor(err('INVALID_REFRESH_TOKEN'))).toBe(SESSION_REVOKED_MESSAGE);
  });

  test('REFRESH_TOKEN_EXPIRED → session revoked', () => {
    expect(authMessageFor(err('REFRESH_TOKEN_EXPIRED'))).toBe(SESSION_REVOKED_MESSAGE);
  });

  test('USER_NOT_FOUND → auth failed', () => {
    expect(authMessageFor(err('USER_NOT_FOUND'))).toBe(AUTH_FAILED_MESSAGE);
  });

  test('unknown code falls back to auth failed', () => {
    expect(authMessageFor(err('SOMETHING_ELSE'))).toBe(AUTH_FAILED_MESSAGE);
  });

  test('empty code falls back to auth failed', () => {
    expect(authMessageFor(err(''))).toBe(AUTH_FAILED_MESSAGE);
  });
});