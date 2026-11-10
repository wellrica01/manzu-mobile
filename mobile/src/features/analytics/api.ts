import { apiRequest } from '@/api/client';
import { inventoryKeys } from '@/features/inventory/api';
import { orderKeys } from '@/features/orders/api';

import type { AnalyticsResponse, AnalyticsRange } from './types';

// Nested under order/inventory keys so mutations there also invalidate analytics.
export const analyticsKeys = {
  query: (range: AnalyticsRange, from: string, to: string) => [...orderKeys.all, 'analytics', range, from, to] as const,
  inventory: () => [...inventoryKeys.lists(), 'analytics'] as const,
};

/** Resolve a range + custom dates into from/to ISO YYYY-MM-DD for the backend. */
export function resolveAnalyticsRange(range: AnalyticsRange, customStart: string, customEnd: string): { from?: string; to?: string } {
  if (range === 'custom') {
    if (!customStart || !customEnd) return {};
    return { from: customStart, to: customEnd };
  }
  if (range === 'all') return { from: '2020-01-01' }; // effectively everything
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function fetchAnalytics(params: { from?: string; to?: string }, signal?: AbortSignal): Promise<AnalyticsResponse> {
  const query: Record<string, string | undefined> = { from: params.from, to: params.to };
  return apiRequest<AnalyticsResponse>('/api/pharmacy/analytics', { signal, query });
}