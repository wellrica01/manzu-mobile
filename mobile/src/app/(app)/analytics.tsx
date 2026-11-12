import { Redirect } from 'expo-router';

import { useIsManager } from '@/features/auth/hooks';
import { AnalyticsScreen } from '@/features/analytics/screens/AnalyticsScreen';

export default function AnalyticsRoute() {
  const manager = useIsManager();

  if (!manager) return <Redirect href="/more" />;

  return <AnalyticsScreen />;
}