import { useRouter, type Href } from 'expo-router';
import { BarChart2, ChevronRight, CreditCard, LogOut, Package, User, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, BrandLogo, Button, Card, Screen, Text } from '@/components/ui';
import { useIsManager } from '@/features/auth/hooks';
import { useSession } from '@/features/auth/store';
import { NotificationsCard } from '@/features/push/NotificationsCard';
import { colors, radius } from '@/theme';

interface MoreItem {
  href: Href;
  label: string;
  icon: LucideIcon;
  managerOnly?: boolean;
}

// Remaining SidebarNav entries (same labels/icons); Staff is new and MANAGER-only.
const ITEMS: MoreItem[] = [
  { href: '/sales-history', label: 'Sales History', icon: Package },
  { href: '/analytics', label: 'Analytics', icon: BarChart2, managerOnly: true },
  { href: '/payment', label: 'Payment', icon: CreditCard, managerOnly: true },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/staff', label: 'Staff', icon: Users, managerOnly: true },
];

export function MoreScreen() {
  const router = useRouter();
  const manager = useIsManager();
  const user = useSession((s) => s.user);
  const pharmacy = useSession((s) => s.pharmacy);
  const signOut = useSession((s) => s.signOut);

  return (
    <Screen>
      <BrandLogo />

      <Card>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <User size={20} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text size="base" weight="semibold" color={colors.gray900} numberOfLines={1}>
              {user?.name || user?.email || 'Pharmacy user'}
            </Text>
            <Text color={colors.gray500} numberOfLines={1}>
              {pharmacy?.name ?? ''}
            </Text>
          </View>
          {user?.role ? <Badge label={user.role} variant={manager ? 'default' : 'secondary'} /> : null}
        </View>
      </Card>

      <Card>
        {ITEMS.filter((item) => !item.managerOnly || manager).map((item, index) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.item, index > 0 && styles.divider, pressed && styles.pressed]}
            >
              <Icon size={20} color={colors.gray600} />
              <Text size="base" weight="medium" color={colors.gray700} style={styles.flex}>
                {item.label}
              </Text>
              <ChevronRight size={18} color={colors.gray400} />
            </Pressable>
          );
        })}
      </Card>

      <NotificationsCard />

      <Button title="Logout" variant="logout" icon={LogOut} size="lg" fullWidth onPress={() => void signOut()} />
      <Text size="xs" color={colors.gray400} align="center">
        © 2026 Manzu Pharmacy
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  divider: { borderTopWidth: 1, borderTopColor: colors.gray100 },
  pressed: { backgroundColor: colors.primarySoft },
});
