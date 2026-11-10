import { useQuery } from '@tanstack/react-query';

import { analyticsKeys, fetchAnalytics, resolveAnalyticsRange } from './api';
import type { AnalyticsRange } from './types';

export function useAnalytics(range: AnalyticsRange, customStart: string, customEnd: string) {
  const { from, to } = resolveAnalyticsRange(range, customStart, customEnd);
  return useQuery({
    queryKey: analyticsKeys.query(range, from ?? '', to ?? ''),
    queryFn: ({ signal }) => fetchAnalytics({ from, to }, signal),
  });
}