import { loginSchema, registerSchema } from '@/features/auth/schemas';

describe('loginSchema', () => {
  test('accepts a valid email + 6-digit pin', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', pin: '123456' });
    expect(r.success).toBe(true);
  });

  test('rejects bad email', () => {
    const r = loginSchema.safeParse({ email: 'nope', pin: '123456' });
    expect(r.success).toBe(false);
  });

  test('rejects 5-digit pin', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', pin: '12345' });
    expect(r.success).toBe(false);
  });

  test('rejects 7-digit pin', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', pin: '1234567' });
    expect(r.success).toBe(false);
  });

  test('rejects non-numeric pin', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', pin: 'abcdef' });
    expect(r.success).toBe(false);
  });

  test('trims email whitespace', () => {
    const r = loginSchema.safeParse({ email: '  a@b.com  ', pin: '123456' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('a@b.com');
  });
});

describe('registerSchema', () => {
    const valid = {
    name: 'Wellrica Pharmacy',
    licenseNumber: 'LIC12345',
    phone: '08012345678',
    address: '12 Main Street Lagos',
    state: 'Kano',
    lga: 'Kano Municipal',
    latitude: 9.05,
    longitude: 8.5,
    locationAccuracy: 10,
    userName: 'Yusuf',
    email: 'y@x.com',
    pin: '123456',
    confirmPin: '123456',
    };

  test('accepts a fully valid payload', () => {
    const r = registerSchema.safeParse(valid);
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });

  test('rejects short pharmacy name', () => {
    const r = registerSchema.safeParse({ ...valid, name: 'AB' });
    expect(r.success).toBe(false);
  });

  test('rejects non-Nigerian phone', () => {
    const r = registerSchema.safeParse({ ...valid, phone: '1234567890' });
    expect(r.success).toBe(false);
  });

  test('accepts +234 phone variant', () => {
    const r = registerSchema.safeParse({ ...valid, phone: '+2348012345678' });
    expect(r.success).toBe(true);
  });

  test('rejects short address', () => {
    const r = registerSchema.safeParse({ ...valid, address: 'Too short' });
    expect(r.success).toBe(false);
  });

  test('rejects latitude outside Nigeria', () => {
    const r = registerSchema.safeParse({ ...valid, latitude: 20 });
    expect(r.success).toBe(false);
  });

  test('rejects mismatched confirmPin', () => {
    const r = registerSchema.safeParse({ ...valid, confirmPin: '999999' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('confirmPin'))).toBe(true);
    }
  });

  test('rejects unknown LGA', () => {
    const r = registerSchema.safeParse({ ...valid, lga: 'Fake LGA' });
    expect(r.success).toBe(false);
  });
});