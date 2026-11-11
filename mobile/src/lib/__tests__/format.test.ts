import { formatDateTime, formatNaira, formatNairaShort, formatShortDateTime, formatTime } from '@/lib/format';

describe('formatNaira', () => {
  test('formats a whole number with ₦ symbol', () => {
    expect(formatNaira(1000)).toMatch(/₦\s?1,000/);
  });

  test('formats 0', () => {
    expect(formatNaira(0)).toMatch(/₦\s?0/);
  });

  test('handles null', () => {
    expect(formatNaira(null)).toMatch(/₦\s?0/);
  });

  test('handles undefined', () => {
    expect(formatNaira(undefined)).toMatch(/₦\s?0/);
  });

  test('formats a large amount', () => {
    expect(formatNaira(1_250_000)).toMatch(/₦\s?1,250,000/);
  });

  test('formats decimal amounts', () => {
    // maximumFractionDigits: 2
    const out = formatNaira(99.5);
    expect(out).toContain('99.5');
  });
});

describe('formatNairaShort', () => {
  test('uses comma separators, no decimals', () => {
    expect(formatNairaShort(1000)).toBe('₦1,000');
  });

  test('handles large values', () => {
    expect(formatNairaShort(1_250_000)).toBe('₦1,250,000');
  });

  test('handles null', () => {
    expect(formatNairaShort(null)).toBe('₦0');
  });

  test('handles undefined', () => {
    expect(formatNairaShort(undefined)).toBe('₦0');
  });

  test('rounds decimals away', () => {
    // toLocaleString on 99.5 returns "99.5" so formatNairaShort(99.5) === "₦99.5"
    expect(formatNairaShort(99.5)).toBe('₦99.5');
  });
});

describe('formatDateTime', () => {
  test('returns em-dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  test('returns em-dash for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  test('returns em-dash for invalid date string', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  test('formats a valid ISO string', () => {
    const out = formatDateTime('2026-11-10T14:30:00Z');
    expect(out).not.toBe('—');
    expect(out).toMatch(/2026/);
  });

  test('formats a Date object', () => {
    const out = formatDateTime(new Date('2026-11-10T14:30:00Z'));
    expect(out).not.toBe('—');
  });

  test('formats a number timestamp', () => {
    const out = formatDateTime(Date.now());
    expect(out).not.toBe('—');
  });
});

describe('formatTime', () => {
  test('formats a timestamp', () => {
    const out = formatTime(Date.now());
    // HH:MM format, 2 digits
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  test('accepts a Date', () => {
    const out = formatTime(new Date('2026-11-10T14:30:00Z'));
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatShortDateTime', () => {
  test('formats with month-day pattern', () => {
    const out = formatShortDateTime('2026-11-04T19:33:00Z');
    expect(out).toMatch(/Nov\s+4/);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  test('returns em-dash on invalid input', () => {
    expect(formatShortDateTime('garbage')).toBe('—');
  });
});