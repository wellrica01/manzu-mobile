import {
  DAYS_OF_WEEK,
  buildProfilePayload,
  formatOperatingHours,
  formatTo12Hour,
  invalidHoursDay,
  parseCoordinate,
  toHoursDraft,
} from '@/features/profile/utils';
import type { OperatingHourSlot, ProfileResponse } from '@/features/profile/types';

function slot(dayOfWeek: number, openTime: string | null = '09:00', closeTime: string | null = '17:00'): OperatingHourSlot {
  return { dayOfWeek, openTime, closeTime };
}

function atLocal(isoLocal: string): Date {
  // The util uses getDay/getHours from the Date in the local TZ. Construct a Date that represents the given local time.
  const [y, m, d, hh, mm] = isoLocal.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

describe('DAYS_OF_WEEK', () => {
  test('has 7 entries starting with Monday', () => {
    expect(DAYS_OF_WEEK).toHaveLength(7);
    expect(DAYS_OF_WEEK[0]).toBe('Monday');
    expect(DAYS_OF_WEEK[6]).toBe('Sunday');
  });
});

describe('formatTo12Hour', () => {
  test('converts 09:00 to 9:00 AM', () => {
    expect(formatTo12Hour('09:00')).toBe('9:00 AM');
  });

  test('converts 13:30 to 1:30 PM', () => {
    expect(formatTo12Hour('13:30')).toBe('1:30 PM');
  });

  test('converts 00:00 (midnight) to 12:00 AM', () => {
    expect(formatTo12Hour('00:00')).toBe('12:00 AM');
  });

  test('converts 12:00 (noon) to 12:00 PM', () => {
    expect(formatTo12Hour('12:00')).toBe('12:00 PM');
  });

  test('strips ISO date prefix when present', () => {
    expect(formatTo12Hour('2026-11-10T14:45:00Z')).toBe('2:45 PM');
  });

  test('returns null for null/undefined/empty', () => {
    expect(formatTo12Hour(null)).toBeNull();
    expect(formatTo12Hour(undefined)).toBeNull();
    expect(formatTo12Hour('')).toBeNull();
  });
});

describe('formatOperatingHours', () => {
  test('returns null for empty hours', () => {
    expect(formatOperatingHours([])).toBeNull();
  });

  test('detects 24/7 when all 7 days are 00:00–23:59', () => {
    const hours = Array.from({ length: 7 }, (_, i) => slot(i, '00:00', '23:59'));
    expect(formatOperatingHours(hours, atLocal('2026-11-10-14-30'))?.status).toBe('open');
    expect(formatOperatingHours(hours, atLocal('2026-11-10-14-30'))?.text).toBe('Open 24/7');
  });

  test('reports open now when within today hours', () => {
    // 2026-11-10 is a Tuesday. Tuesday = dayOfWeek 1.
    const hours = [slot(1, '09:00', '17:00')];
    const r = formatOperatingHours(hours, atLocal('2026-11-10-12-00'));
    expect(r?.status).toBe('open');
    expect(r?.text).toMatch(/Open now until/);
  });

  test('reports closed when before today opening', () => {
    const hours = [slot(1, '09:00', '17:00')];
    const r = formatOperatingHours(hours, atLocal('2026-11-10-07-00'));
    expect(r?.status).toBe('closed');
    expect(r?.text).toMatch(/opens today at 9:00 AM/);
  });

  test('reports closed when after today closing, finds next open day', () => {
    const hours = [slot(1, '09:00', '17:00'), slot(2, '09:00', '17:00')]; // Tue, Wed
    const r = formatOperatingHours(hours, atLocal('2026-11-10-18-00')); // Tue evening
    expect(r?.status).toBe('closed');
    expect(r?.text).toMatch(/Wednesday/);
  });

  test('returns closed today when today is missing', () => {
    const hours = [slot(2, '09:00', '17:00')]; // only Wednesday
    const r = formatOperatingHours(hours, atLocal('2026-11-10-12-00')); // Tuesday
    expect(r?.status).toBe('closed');
    expect(r?.text).toMatch(/Closed today/);
  });
});

describe('toHoursDraft', () => {
  test('empty input returns all 7 days open 09-17', () => {
    const draft = toHoursDraft([]);
    expect(draft).toHaveLength(7);
    draft.forEach((d) => {
      expect(d.openTime).toBe('09:00');
      expect(d.closeTime).toBe('17:00');
      expect(d.isClosed).toBe(false);
    });
  });

  test('days missing from input are marked closed', () => {
    const draft = toHoursDraft([slot(0, '10:00', '18:00')]);
    expect(draft[0]).toMatchObject({ dayOfWeek: 0, openTime: '10:00', closeTime: '18:00', isClosed: false });
    expect(draft[1]).toMatchObject({ dayOfWeek: 1, isClosed: true });
    expect(draft[6]).toMatchObject({ dayOfWeek: 6, isClosed: true });
  });

  test('slot with null openTime is marked closed', () => {
    const draft = toHoursDraft([slot(0, null, null)]);
    expect(draft[0]?.isClosed).toBe(true);
  });
});

describe('invalidHoursDay', () => {
  test('returns null when all hours valid', () => {
    expect(invalidHoursDay([
      { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isClosed: false },
    ])).toBeNull();
  });

  test('returns day name when close <= open', () => {
    expect(invalidHoursDay([
      { dayOfWeek: 1, openTime: '18:00', closeTime: '09:00', isClosed: false },
    ])).toBe('Tuesday');
  });

  test('ignores closed days', () => {
    expect(invalidHoursDay([
      { dayOfWeek: 0, openTime: '18:00', closeTime: '09:00', isClosed: true },
    ])).toBeNull();
  });
});

describe('parseCoordinate', () => {
  test('parses numeric strings', () => {
    expect(parseCoordinate('9.0579')).toBe(9.0579);
  });

  test('accepts numbers directly', () => {
    expect(parseCoordinate(9.0579)).toBe(9.0579);
  });

  test('returns null for null/undefined/empty', () => {
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate(undefined)).toBeNull();
    expect(parseCoordinate('')).toBeNull();
  });

  test('returns null for NaN input', () => {
    expect(parseCoordinate('abc')).toBeNull();
  });

  test('parses 0 correctly', () => {
    expect(parseCoordinate(0)).toBe(0);
    expect(parseCoordinate('0')).toBe(0);
  });
});

describe('buildProfilePayload', () => {
  test('maps profile fields into the update payload', () => {
    const profile = {
      user: { id: 1, name: 'Yusuf', email: 'y@x.com', role: 'MANAGER' },
      pharmacy: {
        id: 7,
        name: 'Wellrica',
        address: '12 Main St',
        lga: 'Nassarawa',
        state: 'Kano',
        ward: 'Ward 1',
        phone: '08012345678',
        licenseNumber: 'LIC123',
        logoUrl: 'https://x.com/logo.png',
        latitude: 9.05,
        longitude: 8.5,
        deliveryAvailability: true,
      },
    } as unknown as ProfileResponse;
    const out = buildProfilePayload(profile);
    expect(out.user.name).toBe('Yusuf');
    expect(out.pharmacy.state).toBe('Kano');
    expect(out.pharmacy.deliveryAvailability).toBe(true);
  });

  test('applies overrides', () => {
    const profile = {
      user: { id: 1, name: 'Yusuf', email: 'y@x.com', role: 'MANAGER' },
      pharmacy: { id: 7, name: 'Wellrica', address: '12 Main St', lga: 'X', state: 'Y', ward: 'W', phone: '08012345678', licenseNumber: 'LIC', logoUrl: null, latitude: null, longitude: null, deliveryAvailability: false },
    } as unknown as ProfileResponse;
    const out = buildProfilePayload(profile, { user: { name: 'New' }, pharmacy: { phone: '08099999999' } });
    expect(out.user.name).toBe('New');
    expect(out.pharmacy.phone).toBe('08099999999');
    expect(out.user.email).toBe('y@x.com'); // not overridden
  });
});