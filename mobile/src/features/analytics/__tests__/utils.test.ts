import {
  ANALYTICS_RANGES,
  compactNaira,
  computeInventoryHealth,
  computeOrderAnalytics,
  filterOrdersByRange,
} from '@/features/analytics/utils';
import type { OrderSummary } from '@/features/orders/types';
import type { CatalogMedication } from '@/features/inventory/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-10T12:00:00Z').getTime();

function order(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 1,
    sn: 1,
    name: 'Alice',
    phone: '08012345678',
    email: 'a@b.com',
    createdAt: new Date(NOW).toISOString(),
    trackingCode: null,
    userIdentifier: 'user-a',
    deliveryMethod: 'COURIER',
    address: 'Lagos',
    status: 'CONFIRMED',
    totalPrice: 1000,
    pharmacyAmount: 900,
    prescription: null,
    items: [],
    ...overrides,
  } as OrderSummary;
}

function med(overrides: Partial<CatalogMedication> = {}): CatalogMedication {
  return {
    medicationId: 1,
    brandName: 'X',
    form: 'TABLET',
    packSizeExpression: null,
    packSizeUnit: null,
    regulatoryClass: null,
    prescriptionRequired: false,
    ingredients: [],
    activeSubstances: '',
    displayName: 'X',
    manufacturer: null,
    manufacturerName: null,
    isStocked: true,
    pharmacyId: 7,
    stock: 10,
    price: 100,
    expiryDate: null,
    receivedDate: null,
    batchNumber: null,
    ...overrides,
  } as CatalogMedication;
}

describe('ANALYTICS_RANGES', () => {
  test('has 5 ranges in the expected order', () => {
    expect(ANALYTICS_RANGES.map((r) => r.value)).toEqual(['7d', '30d', '90d', 'all', 'custom']);
  });
});

describe('filterOrdersByRange', () => {
  test('all returns everything unchanged', () => {
    const list = [order({ id: 1 }), order({ id: 2 })];
    expect(filterOrdersByRange(list, 'all', '', '', NOW)).toHaveLength(2);
  });

  test('7d drops orders older than 7 days', () => {
    const list = [
      order({ id: 1, createdAt: new Date(NOW - 3 * DAY_MS).toISOString() }),
      order({ id: 2, createdAt: new Date(NOW - 10 * DAY_MS).toISOString() }),
    ];
    const out = filterOrdersByRange(list, '7d', '', '', NOW);
    expect(out.map((o) => o.id)).toEqual([1]);
  });

  test('30d keeps orders 3 days old, drops 45 days old', () => {
    const list = [
      order({ id: 1, createdAt: new Date(NOW - 3 * DAY_MS).toISOString() }),
      order({ id: 2, createdAt: new Date(NOW - 45 * DAY_MS).toISOString() }),
    ];
    const out = filterOrdersByRange(list, '30d', '', '', NOW);
    expect(out.map((o) => o.id)).toEqual([1]);
  });

  test('custom returns all when either end is missing', () => {
    const list = [order({ id: 1 })];
    expect(filterOrdersByRange(list, 'custom', '2026-01-01', '', NOW)).toHaveLength(1);
    expect(filterOrdersByRange(list, 'custom', '', '2026-12-31', NOW)).toHaveLength(1);
  });

  test('custom keeps orders within the given date bounds', () => {
    const list = [
      order({ id: 1, createdAt: '2026-10-15T12:00:00Z' }),
      order({ id: 2, createdAt: '2026-11-15T12:00:00Z' }),
      order({ id: 3, createdAt: '2026-09-15T12:00:00Z' }),
    ];
    const out = filterOrdersByRange(list, 'custom', '2026-10-01', '2026-10-31', NOW);
    expect(out.map((o) => o.id)).toEqual([1]);
  });
});

describe('computeOrderAnalytics', () => {
  test('empty list returns zeros', () => {
    const r = computeOrderAnalytics([]);
    expect(r.totalRevenue).toBe(0);
    expect(r.totalOrders).toBe(0);
    expect(r.avgOrderValue).toBe(0);
    expect(r.uniqueCustomers).toBe(0);
    expect(r.retentionRate).toBe(0);
    expect(r.statusCounts).toEqual([]);
    expect(r.topMedications).toEqual([]);
    expect(r.revenueByDay).toEqual([]);
  });

  test('sums totalRevenue from pharmacyAmount, avgOrderValue from totalPrice', () => {
    const r = computeOrderAnalytics([
      order({ id: 1, pharmacyAmount: 900, totalPrice: 1000 }),
      order({ id: 2, pharmacyAmount: 1800, totalPrice: 2000 }),
    ]);
    expect(r.totalRevenue).toBe(2700);
    expect(r.totalOrders).toBe(2);
    expect(r.avgOrderValue).toBe(1500);
  });

  test('counts unique and returning customers', () => {
    const r = computeOrderAnalytics([
      order({ id: 1, userIdentifier: 'a' }),
      order({ id: 2, userIdentifier: 'a' }),
      order({ id: 3, userIdentifier: 'b' }),
      order({ id: 4, userIdentifier: 'b' }),
      order({ id: 5, userIdentifier: 'c' }),
    ]);
    expect(r.uniqueCustomers).toBe(3);
    expect(r.returningCustomers).toBe(2);
    expect(r.retentionRate).toBe(67); // round(2/3*100) = 67
  });

  test('groups status counts', () => {
    const r = computeOrderAnalytics([
      order({ id: 1, status: 'CONFIRMED' }),
      order({ id: 2, status: 'CONFIRMED' }),
      order({ id: 3, status: 'COMPLETED' }),
    ]);
    const byStatus = Object.fromEntries(r.statusCounts.map((s) => [s.status, s.count]));
    expect(byStatus.CONFIRMED).toBe(2);
    expect(byStatus.COMPLETED).toBe(1);
  });

  test('aggregates top medications by quantity, max 5', () => {
    const r = computeOrderAnalytics([
      order({
        id: 1,
        items: [
          { id: 1, medication: { brandName: 'A' } as never, quantity: 5, price: 100 } as never,
          { id: 2, medication: { brandName: 'B' } as never, quantity: 2, price: 100 } as never,
        ],
      }),
      order({
        id: 2,
        items: [{ id: 3, medication: { brandName: 'A' } as never, quantity: 1, price: 100 } as never],
      }),
    ]);
    expect(r.topMedications[0]?.name).toBe('A');
    expect(r.topMedications[0]?.count).toBe(6);
    expect(r.topMedications[0]?.revenue).toBe(600);
  });

  test('groups revenue by day and sorts ascending', () => {
    const r = computeOrderAnalytics([
      order({ id: 1, createdAt: '2026-11-02T10:00:00Z', totalPrice: 1000 }),
      order({ id: 2, createdAt: '2026-11-01T10:00:00Z', totalPrice: 500 }),
      order({ id: 3, createdAt: '2026-11-01T20:00:00Z', totalPrice: 300 }),
    ]);
    expect(r.revenueByDay).toHaveLength(2);
    expect(r.revenueByDay[0]?.revenue).toBe(800);
    expect(r.revenueByDay[1]?.revenue).toBe(1000);
  });
});

describe('computeInventoryHealth', () => {
  test('empty array returns zeros', () => {
    expect(computeInventoryHealth([])).toEqual({ totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 });
  });

  test('counts low, out, and computes total value', () => {
    const h = computeInventoryHealth([
      med({ stock: 0, price: 100 }), // out
      med({ stock: 5, price: 100 }), // low
      med({ stock: 9, price: 100 }), // low
      med({ stock: 10, price: 100 }), // in stock (not low, exactly at boundary)
      med({ stock: 100, price: 100 }), // in stock
    ]);
    expect(h.totalItems).toBe(5);
    expect(h.lowStock).toBe(2);
    expect(h.outOfStock).toBe(1);
    expect(h.totalValue).toBe(100 * (0 + 5 + 9 + 10 + 100)); // 12400
  });

  test('handles null stock and price', () => {
    const h = computeInventoryHealth([
      med({ stock: null as never, price: null as never }),
    ]);
    expect(h.totalItems).toBe(1);
    expect(h.outOfStock).toBe(0);
    expect(h.totalValue).toBe(0);
  });
});

describe('compactNaira', () => {
  test('returns plain ₦ for < 1000', () => {
    expect(compactNaira(500)).toBe('₦500');
    expect(compactNaira(0)).toBe('₦0');
  });

  test('returns k-suffixed for >= 1000 and < 1M', () => {
    expect(compactNaira(1500)).toBe('₦1.5k');
    expect(compactNaira(1000)).toBe('₦1k');
    expect(compactNaira(999_999)).toMatch(/k$/);
  });

  test('returns M-suffixed for >= 1M', () => {
    expect(compactNaira(1_250_000)).toBe('₦1.3M');
    expect(compactNaira(1_000_000)).toBe('₦1M');
  });

  test('strips trailing .0 in suffixed output', () => {
    expect(compactNaira(5000)).toBe('₦5k');
    expect(compactNaira(5_000_000)).toBe('₦5M');
  });
});