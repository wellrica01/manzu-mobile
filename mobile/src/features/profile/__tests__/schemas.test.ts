import { changePinSchema, coordinatesSchema, profileFormSchema } from '@/features/profile/schemas';

describe('profileFormSchema', () => {
    const valid = {
    userName: 'Yusuf',
    userEmail: 'y@x.com',
    name: 'Wellrica',
    address: '12 Main St',
    state: 'Kano',
    lga: 'Kano Municipal',
    ward: '',
    phone: '08012345678',
    deliveryAvailability: true,
    };

  test('accepts a valid payload', () => {
    expect(profileFormSchema.safeParse(valid).success).toBe(true);
  });

  test('rejects empty userName', () => {
    expect(profileFormSchema.safeParse({ ...valid, userName: '' }).success).toBe(false);
  });

  test('rejects bad email', () => {
    expect(profileFormSchema.safeParse({ ...valid, userEmail: 'nope' }).success).toBe(false);
  });

  test('rejects empty name', () => {
    expect(profileFormSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  test('rejects empty state', () => {
    expect(profileFormSchema.safeParse({ ...valid, state: '' }).success).toBe(false);
  });

  test('rejects unknown LGA', () => {
    expect(profileFormSchema.safeParse({ ...valid, lga: 'Not a real LGA' }).success).toBe(false);
  });
});

describe('coordinatesSchema', () => {
  test('accepts valid Nigeria coordinates as strings', () => {
    const r = coordinatesSchema.safeParse({ latitude: '9.05', longitude: '8.5' });
    expect(r.success).toBe(true);
  });

  test('rejects empty latitude', () => {
    const r = coordinatesSchema.safeParse({ latitude: '', longitude: '8.5' });
    expect(r.success).toBe(false);
  });

  test('rejects non-numeric latitude', () => {
    const r = coordinatesSchema.safeParse({ latitude: 'abc', longitude: '8.5' });
    expect(r.success).toBe(false);
  });

  test('rejects coordinates outside Nigeria', () => {
    const r = coordinatesSchema.safeParse({ latitude: '55.0', longitude: '8.5' });
    expect(r.success).toBe(false);
  });
});

describe('changePinSchema', () => {
  test('accepts matching 6-digit pins', () => {
    const r = changePinSchema.safeParse({ currentPin: '123456', newPin: '654321', confirmPin: '654321' });
    expect(r.success).toBe(true);
  });

  test('rejects 5-digit currentPin', () => {
    expect(changePinSchema.safeParse({ currentPin: '12345', newPin: '654321', confirmPin: '654321' }).success).toBe(false);
  });

  test('rejects non-numeric pin', () => {
    expect(changePinSchema.safeParse({ currentPin: 'abcdef', newPin: '654321', confirmPin: '654321' }).success).toBe(false);
  });

  test('rejects mismatched confirmPin', () => {
    const r = changePinSchema.safeParse({ currentPin: '123456', newPin: '654321', confirmPin: '000000' });
    expect(r.success).toBe(false);
  });
});