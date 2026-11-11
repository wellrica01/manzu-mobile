import { decodePharmacyToken, isTokenExpired, tokenExpiresAt, type PharmacyJwtPayload } from '@/lib/jwt';

/** Build a synthetic JWT with an arbitrary payload (never validated here — server does that). */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('decodePharmacyToken', () => {
  test('returns the payload for a valid pharmacy token', () => {
    const token = makeJwt({ userId: 6, pharmacyId: 7, role: 'MANAGER', exp: Math.floor(Date.now() / 1000) + 86400 });
    const payload = decodePharmacyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(6);
    expect(payload?.pharmacyId).toBe(7);
    expect(payload?.role).toBe('MANAGER');
  });

  test('returns null for a malformed token', () => {
    expect(decodePharmacyToken('not-a-jwt')).toBeNull();
  });

  test('returns null when userId is missing', () => {
    const token = makeJwt({ pharmacyId: 7, role: 'MANAGER' });
    expect(decodePharmacyToken(token)).toBeNull();
  });

  test('returns null when pharmacyId is missing', () => {
    const token = makeJwt({ userId: 6, role: 'MANAGER' });
    expect(decodePharmacyToken(token)).toBeNull();
  });

  test('returns null when userId is not a number', () => {
    const token = makeJwt({ userId: '6', pharmacyId: 7, role: 'MANAGER' });
    expect(decodePharmacyToken(token)).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(decodePharmacyToken('')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  function payload(expSecondsFromNow: number): PharmacyJwtPayload {
    return {
      userId: 1,
      pharmacyId: 1,
      role: 'MANAGER',
      exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    };
  }

  test('returns false when exp is well in the future', () => {
    expect(isTokenExpired(payload(3600))).toBe(false);
  });

  test('returns true when exp has passed', () => {
    expect(isTokenExpired(payload(-60))).toBe(true);
  });

  test('treats tokens expiring within the 30s skew as expired', () => {
    // Default skew = 30s; a token expiring in 10s should be treated as expired.
    expect(isTokenExpired(payload(10))).toBe(true);
  });

  test('accepts a custom skew (0 = no margin)', () => {
    expect(isTokenExpired(payload(10), 0)).toBe(false);
    expect(isTokenExpired(payload(-1), 0)).toBe(true);
  });

  test('returns false when exp is missing (never expires locally)', () => {
    const noExp: PharmacyJwtPayload = { userId: 1, pharmacyId: 1, role: 'MANAGER' };
    expect(isTokenExpired(noExp)).toBe(false);
  });
});

describe('tokenExpiresAt', () => {
  test('returns exp in milliseconds', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(tokenExpiresAt({ userId: 1, pharmacyId: 1, role: 'MANAGER', exp })).toBe(exp * 1000);
  });

  test('returns null when exp is missing', () => {
    expect(tokenExpiresAt({ userId: 1, pharmacyId: 1, role: 'MANAGER' })).toBeNull();
  });
});