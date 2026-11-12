import { Activity } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { formatNairaShort, formatShortDateTime } from '@/lib/format';
import { colors, radius, shadows } from '@/theme';

import type { RecentActivity } from '../types';
import { DashCard } from './DashCard';

// Status chip colours copied from the web dashboard (raw status text, no relabelling).
function statusColors(status: string): { bg: string; fg: string } {
  if (status === 'CONFIRMED' || status === 'PAID' || status === 'CASH' || status === 'CARD') return { bg: colors.green100, fg: colors.green800 };
  if (status === 'PROCESSING') return { bg: colors.blue100, fg: colors.blue800 };
  if (status === 'READY_FOR_PICKUP') return { bg: colors.purple100, fg: colors.purple800 };
  return { bg: colors.gray100, fg: colors.gray700 };
}

function Chip({ label, bg, fg, pill }: { label: string; bg: string; fg: string; pill?: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderRadius: pill ? radius.full : 4 }]}>
      <Text size="xs" weight="semibold" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function RecentActivityCard({ activity }: { activity: RecentActivity[] }) {
  return (
    <DashCard gradient={[colors.white, colors.white]}>
      <View style={styles.header}>
        <Text size="xl" weight="bold" color={colors.gray900}>
          Recent Activity
        </Text>
        <View style={styles.count}>
          <Activity size={14} color={colors.gray500} />
          <Text size="xs" color={colors.gray500}>
            Last {activity.length} transactions
          </Text>
        </View>
      </View>

      {activity.length === 0 ? (
        <View style={styles.empty}>
          <Activity size={40} color={colors.gray300} />
          <Text size="base" weight="medium" color={colors.gray400}>
            No recent activity
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {activity.map((item, index) => {
            const typeColors = item.type === 'ORDER' ? { bg: colors.blue100, fg: colors.blue700 } : { bg: colors.purple100, fg: colors.purple700 };
            const status = statusColors(item.status);
            return (
              <View key={`${item.type}-${item.id}-${index}`} style={[styles.item, shadows.sm]}>
                <View style={styles.itemTop}>
                  <View style={styles.inline}>
                    <Chip label={item.type} bg={typeColors.bg} fg={typeColors.fg} />
                    <Text size="xs" color={colors.gray500} style={styles.mono}>
                      #{item.id}
                    </Text>
                  </View>
                  <Chip label={item.status} bg={status.bg} fg={status.fg} pill />
                </View>
                <View style={styles.itemBottom}>
                  <View style={styles.flex}>
                    <Text weight="medium" color={colors.gray700} numberOfLines={1}>
                      {item.name || 'Walk-in'}
                    </Text>
                    <Text size="xs" color={colors.gray500}>
                      {formatShortDateTime(item.time)}
                    </Text>
                  </View>
                  {item.amount !== undefined ? (
                    <Text size="base" weight="bold" color={colors.green600}>
                      {formatNairaShort(item.amount)}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </DashCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, paddingRight: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  list: { gap: 12 },
  item: { borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, padding: 12, backgroundColor: colors.white },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2 },
  mono: { fontVariant: ['tabular-nums'] },
});
