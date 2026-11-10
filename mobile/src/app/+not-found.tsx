import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/store';

export default function NotFound() {
  const status = useSession((s) => s.status);
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/(app)/(tabs)' : '/(auth)/login'} />;
}