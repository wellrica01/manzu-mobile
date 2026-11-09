import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/store';

export default function Index() {
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';
  return <Redirect href={signedIn ? '/(app)/(tabs)' : '/(auth)/login'} />;
}