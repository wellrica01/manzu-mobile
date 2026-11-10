import { Activity, DollarSign, Filter, LineChart as LineChartIcon, PieChart as PieChartIcon, Pill, ShoppingCart, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Card, ChipGroup, DateField, ErrorState, Screen, Skeleton, Text } from '@/components/ui';
import { formatNairaShort } from '@/lib/format';
import { colors, gradients, radius } from '@/theme';

import { CustomerInsightsCard, InventoryHealthCard, StatTile, TopMedicationsTable } from '../components/AnalyticsCards';
import { ChartCard, RevenueTrendChart, StatusDonut, TopMedsChart } from '../components/AnalyticsCharts';
import { useAnalytics } from '../hooks';
import type { AnalyticsRange } from '../types';
import { ANALYTICS_RANGES } from '../utils';

// Server-side aggregation (G8): one call to GET /api/pharmacy/analytics per range.
export function AnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const analytics = useAnalytics(range, customStart, customEnd);
  const metrics = analytics.data;
  const health = analytics.data?.inventoryHealth;
  const error = analytics.error;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await analytics.refetch();
    setRefreshing(false);
  }, [analytics]);

  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={onRefresh} dataUpdatedAt={analytics.dataUpdatedAt || undefined}>
      <LinearGradient colors={gradients.brandText} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hero}>
        <View style={styles.inline}>
          <Activity size={22} color={colors.white} />
          <Text size="xl" weight="bold" color={colors.white}>
            Analytics Dashboard
          </Text>
        </View>
        <Text color="rgba(255,255,255,0.9)">{"Comprehensive insights into your pharmacy's performance"}</Text>
      </LinearGradient>

      <Card style={styles.filterCard}>
        <View style={styles.inline}>
          <Filter size={16} color={colors.brandBlue} />
          <Text weight="semibold" color={colors.gray900}>
            Time Period
          </Text>
        </View>
        <ChipGroup options={ANALYTICS_RANGES} value={range} onChange={setRange} />
        {range === 'custom' ? (
          <View style={styles.dates}>
            <View style={styles.flex}>
              <DateField label="Start Date" value={customStart} onChange={setCustomStart} />
            </View>
            <View style={styles.flex}>
              <DateField label="End Date" value={customEnd} onChange={setCustomEnd} />
            </View>
          </View>
        ) : null}
      </Card>

      {metrics && health ? (
        <>
          <View style={styles.grid}>
            <StatTile icon={DollarSign} label="Total Revenue" value={formatNairaShort(Math.round(metrics.totalRevenue))} color={colors.primary} />
            <StatTile icon={ShoppingCart} label="Total Orders" value={metrics.totalOrders} color={colors.brandBlue} />
            <StatTile icon={Activity} label="Avg Order Value" value={formatNairaShort(Math.round(metrics.avgOrderValue))} color={colors.violet} />
            <StatTile icon={Users} label="Unique Customers" value={metrics.uniqueCustomers} color={colors.warning} />
          </View>
          <ChartCard title="Revenue Trend" icon={LineChartIcon}>
            <RevenueTrendChart data={metrics.revenueByDay} />
          </ChartCard>
          <ChartCard title="Order Status Distribution" icon={PieChartIcon}>
            <StatusDonut data={metrics.statusCounts} />
          </ChartCard>
          <ChartCard title="Top Selling Medications" icon={Pill}>
            <TopMedsChart data={metrics.topMedications} />
          </ChartCard>
          <CustomerInsightsCard unique={metrics.uniqueCustomers} returning={metrics.returningCustomers} retention={metrics.retentionRate} />
          <InventoryHealthCard health={health} />
          <TopMedicationsTable medications={metrics.topMedications} />
        </>
      ) : error ? (
        <ErrorState error={error} title="Failed to load analytics" onRetry={() => void onRefresh()} />
      ) : (
        <View style={styles.skeletons} accessibilityLabel="Loading analytics">
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={112} style={styles.skeletonTile} />
            ))}
          </View>
          <Skeleton height={260} style={styles.skeletonCard} />
          <Skeleton height={220} style={styles.skeletonCard} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { borderRadius: radius['2xl'], padding: 20, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterCard: { padding: 16, gap: 12 },
  dates: { flexDirection: 'row', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  skeletons: { gap: 16 },
  skeletonTile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.lg },
  skeletonCard: { borderRadius: radius['2xl'] },
});