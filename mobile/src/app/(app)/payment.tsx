import { Redirect } from 'expo-router';

import { useIsManager } from '@/features/auth/hooks';
import { PaymentScreen } from '@/features/payouts/screens/PaymentScreen';

export default function PaymentRoute() {
  const manager = useIsManager();

  if (!manager) return <Redirect href="/more" />;

  return <PaymentScreen />;
}