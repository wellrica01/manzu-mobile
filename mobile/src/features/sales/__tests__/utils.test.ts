import {
  EMPTY_SALES_FILTERS,
  activeQuickDate,
  itemCount,
  quickDateFilters,
  saleItems,
  toExportQuery,
  toSalesQuery,
} from '@/features/sales/utils';

describe('EMPTY_SALES_FILTERS', () => {
  test('all values are empty strings', () => {
    Object.values(EMPTY_SALES_FILTERS).forEach((v) => expect(v).toBe(''));
  });
});

describe('saleItems', () => {
  test('returns [] for non-array items', () => {
    expect(saleItems({ items: null as never })).toEqual([]);
    expect(saleItems({ items: 'oops' as never })).toEqual([]);
  });

  test('drops non-object entries', () => {
    expect(saleItems({ items: [null, 'x', 3] as never })).toEqual([]);
  });

  test('coerces numeric strings and defaults', () => {
    const out = saleItems({
      items: [{ medicationId: '5', quantity: '2', price: '100', name: 'A' }] as never,
    });
    expect(out[0]).toEqual({ medicationId: 5, quantity: 2, price: 100, name: 'A' });
  });

  test('defaults name to "Unknown" and numbers to 0', () => {
    const out = saleItems({ items: [{ medicationId: 1 }] as never });
    expect(out[0]).toMatchObject({ medicationId: 1, quantity: 0, price: 0, name: 'Unknown' });
  });
});

describe('itemCount', () => {
  test('sums quantities', () => {
    expect(itemCount([{ medicationId: 1, quantity: 2, price: 100, name: 'A' }, { medicationId: 2, quantity: 3, price: 50, name: 'B' }])).toBe(5);
  });
  test('returns 0 for empty list', () => {
    expect(itemCount([])).toBe(0);
  });
});

describe('toSalesQuery / toExportQuery', () => {
  test('date only — no start/end passed', () => {
    const q = toSalesQuery({ ...EMPTY_SALES_FILTERS, date: '2026-11-10' });
    expect(q).toMatchObject({ date: '2026-11-10', startDate: undefined, endDate: undefined });
  });

  test('date wins over start/end', () => {
    const q = toSalesQuery({ ...EMPTY_SALES_FILTERS, date: '2026-11-10', startDate: '2026-11-01', endDate: '2026-11-09' });
    expect(q.date).toBe('2026-11-10');
    expect(q.startDate).toBeUndefined();
    expect(q.endDate).toBeUndefined();
  });

  test('range applies when both ends present and no date', () => {
    const q = toSalesQuery({ ...EMPTY_SALES_FILTERS, startDate: '2026-11-01', endDate: '2026-11-09' });
    expect(q).toMatchObject({ date: undefined, startDate: '2026-11-01', endDate: '2026-11-09' });
  });

  test('range is dropped if only one end is set', () => {
    const q = toSalesQuery({ ...EMPTY_SALES_FILTERS, startDate: '2026-11-01' });
    expect(q.startDate).toBeUndefined();
    expect(q.endDate).toBeUndefined();
  });

  test('toExportQuery omits min/max amounts', () => {
    const q = toExportQuery({ ...EMPTY_SALES_FILTERS, minAmount: '100', maxAmount: '500' });
    expect(q).not.toHaveProperty('minAmount');
    expect(q).not.toHaveProperty('maxAmount');
  });
});

describe('quickDateFilters', () => {
  test('clear returns all-empty', () => {
    expect(quickDateFilters('clear')).toEqual({ date: '', startDate: '', endDate: '' });
  });

  test('today and yesterday each produce a single date', () => {
    const t = quickDateFilters('today');
    const y = quickDateFilters('yesterday');
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(y.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t.date).not.toBe(y.date);
    expect(t.startDate).toBe('');
    expect(t.endDate).toBe('');
  });

  test('week produces start and end', () => {
    const r = quickDateFilters('week');
    expect(r.date).toBe('');
    expect(r.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

    test('month produces start=first-of-month in local time, end=today', () => {
    const r = quickDateFilters('month');
    expect(r.startDate).toMatch(/-01$/);
    expect(r.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Both must be in the same year-month (the local month).
    expect(r.startDate?.slice(0, 7)).toBe(r.endDate?.slice(0, 7));
    });
});

describe('activeQuickDate', () => {
  test('returns the type matching the current filters', () => {
    const today = quickDateFilters('today');
    const f = { ...EMPTY_SALES_FILTERS, ...today };
    expect(activeQuickDate(f)).toBe('today');
  });

  test('returns null for manual filters', () => {
    expect(activeQuickDate({ ...EMPTY_SALES_FILTERS, date: '2020-01-01' })).toBeNull();
  });
});