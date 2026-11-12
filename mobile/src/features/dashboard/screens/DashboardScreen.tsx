import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { payoutKeys } from '@/features/payouts/api';
import { PayoutSummaryWidget } from '@/features/payouts/components/PayoutSummaryWidget';
import { profileKeys, profileQueryOptions } from '@/features/profile/api';
import { PharmacyStatusBanner } from '@/features/profile/components/PharmacyStatusBanner';
import { formatDateTime } from '@/lib/format';
import { colors, radius } from '@/theme';
import { useIsManager } from '@/features/auth/hooks';

import { dashboardKeys, dashboardQueryOptions } from '../api';
import { MetricCard, OnlineOrdersCard } from '../components/MetricCards';
import { LowStockCard, TopSellingCard } from '../components/MedicationLists';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { InventoryStatusCard, RevenueTodayCard } from '../components/SummaryCards';

// Mirrors manzu-f app/pharmacy/(dashboard)/dashboard/page.jsx, stacked vertically.
export function DashboardScreen() {
  const router = useRouter();
  const manager = useIsManager();
  const queryClient = useQueryClient();
  const dashboard = useQuery(dashboardQueryOptions);
  const profile = useQuery(profileQueryOptions);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.refetchQueries({ queryKey: dashboardKeys.all }),
      queryClient.refetchQueries({ queryKey: payoutKeys.summary() }),
      queryClient.refetchQueries({ queryKey: profileKeys.all }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const data = dashboard.data;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} dataUpdatedAt={dashboard.dataUpdatedAt || undefined}>
      <View>
        <Text size="2xl" weight="bold" color={colors.gray900}>
          Dashboard
        </Text>
        <View style={styles.subtitle}>
          <Text color={colors.gray600}>{"Monitor your pharmacy's performance"}</Text>
          {data && data.pendingOrders > 0 ? (
            <View style={styles.pendingPill}>
              <Text size="xs" weight="medium" color={colors.orange800}>
                {data.pendingOrders} pending orders
              </Text>
            </View>
          ) : null}
        </View>
        {data ? (
          <Text size="xs" color={colors.gray500}>
            Last updated {formatDateTime(dashboard.dataUpdatedAt)}
          </Text>
        ) : null}
      </View>

      <PharmacyStatusBanner status={profile.data?.pharmacy.status} />

      {data ? (
        <>
          <MetricCard
            icon={ShoppingCart}
            label="Walk-in Sales"
            value={data.posSalesToday || 0}
            color={colors.brandPurple}
            trend={data.posSalesTrend || 0}
            subtitle="Tap to open POS"
            onPress={() => router.push('/pos')}
          />
          <OnlineOrdersCard
            ordersToday={data.ordersToday || 0}
            trend={manager ? data.revenueTrend || 0 : 0}
            pending={data.pendingOrders || 0}
            processing={data.processingOrders || 0}
            completed={data.completedOrders || 0}
            onPress={() => router.push('/orders')}
          />
            {manager ? (
              <>
                <RevenueTodayCard
                  revenue={(data.revenueToday || 0) + (data.posRevenueToday || 0)}
                  transactions={(data.ordersToday || 0) + (data.posSalesToday || 0)}
                />
                <PayoutSummaryWidget />
              </>
            ) : null}
          <InventoryStatusCard lowStock={data.inventoryAlerts || 0} expiring={data.expiringMeds || 0} onPress={() => router.push('/inventory')} />
          <TopSellingCard medications={data.topSellingMeds ?? []} />
          <LowStockCard medications={data.lowStockMeds ?? []} />
          <RecentActivityCard activity={data.recentActivity ?? []} />
        </>
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} title="Failed to load dashboard data" onRetry={() => void dashboard.refetch()} />
      ) : (
        <DashboardSkeleton />
      )}
    </Screen>
  );
}

function DashboardSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityLabel="Loading dashboard">
      {[132, 168, 112, 140, 112].map((h, i) => (
        <Skeleton key={i} height={h} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  pendingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.orange100 },
  skeleton: { gap: 16 },
  skeletonCard: { borderRadius: radius['2xl'] },
});
