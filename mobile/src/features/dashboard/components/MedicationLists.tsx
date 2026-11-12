import { AlertTriangle, BarChart3 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { formatNairaShort } from '@/lib/format';
import { colors, radius } from '@/theme';

import type { LowStockMed, TopSellingMed } from '../types';
import { DashCard } from './DashCard';

export function TopSellingCard({ medications }: { medications: TopSellingMed[] }) {
  return (
    <DashCard gradient={[colors.white, colors.white]}>
      <View style={styles.title}>
        <BarChart3 size={18} color={colors.brandBlue} />
        <Text size="base" weight="semibold" color={colors.brandBlue}>
          Top Selling (Last 7 Days)
        </Text>
      </View>
      <View style={styles.list}>
        {medications.map((med, idx) => (
          <View key={`${med.name}-${idx}`} style={[styles.row, styles.topRow]}>
            <View style={styles.flex}>
              <Text weight="semibold" color={colors.gray900} numberOfLines={1}>
                {med.name}
              </Text>
              <Text size="xs" color={colors.gray500}>
                {med.orders} orders • {med.quantity} units
              </Text>
            </View>
            {med.revenue !== undefined ? (
              <Text size="base" weight="bold" color={colors.green600}>
                {formatNairaShort(med.revenue)}
              </Text>
            ) : null}
          </View>
        ))}
        {medications.length === 0 ? (
          <Text color={colors.gray400} align="center" style={styles.empty}>
            No sales data available
          </Text>
        ) : null}
      </View>
    </DashCard>
  );
}

export function LowStockCard({ medications }: { medications: LowStockMed[] }) {
  return (
    <DashCard gradient={[colors.white, colors.white]}>
      <View style={styles.title}>
        <AlertTriangle size={18} color={colors.brandRed} />
        <Text size="base" weight="semibold" color={colors.brandRed}>
          Low Stock Alert
        </Text>
      </View>
      <View style={styles.list}>
        {medications.map((med, idx) => (
          <View key={`${med.name}-${idx}`} style={[styles.row, styles.lowRow]}>
            <View style={styles.flex}>
              <Text weight="semibold" color={colors.gray900} numberOfLines={1}>
                {med.name}
              </Text>
              {med.form ? (
                <Text size="xs" color={colors.gray500} numberOfLines={1}>
                  {med.form}
                </Text>
              ) : null}
            </View>
            <View style={styles.right}>
              <Text size="base" weight="bold" color={colors.red600}>
                {med.stock ?? 0} left
              </Text>
              <Text size="xs" color={colors.gray500}>
                {formatNairaShort(med.price)}
              </Text>
            </View>
          </View>
        ))}
        {medications.length === 0 ? (
          <Text color={colors.gray400} align="center" style={styles.empty}>
            All medications well stocked
          </Text>
        ) : null}
      </View>
    </DashCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.lg },
  topRow: { backgroundColor: 'rgba(249,250,251,0.7)' },
  lowRow: { backgroundColor: 'rgba(254,242,242,0.5)', borderWidth: 1, borderColor: colors.red100 },
  right: { alignItems: 'flex-end' },
  empty: { paddingVertical: 24 },
});
