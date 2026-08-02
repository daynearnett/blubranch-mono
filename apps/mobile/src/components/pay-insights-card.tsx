// "What's it paying?" (wage transparency Phase 0, E3) — posted hourly pay
// ranges for the worker's trade + state. Hidden entirely under n=5 postings.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DollarSign } from 'lucide-react-native';
import { jobs, type PayInsights } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

export function PayInsightsCard() {
  const [data, setData] = useState<PayInsights | null>(null);

  useEffect(() => {
    jobs.payInsights().then(setData).catch(() => {});
  }, []);

  if (!data || data.insufficient || !data.hourly) return null;

  const fmt = (v: number) => `$${Math.round(v)}`;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <DollarSign color={colors.navy} size={15} strokeWidth={2.2} />
        <Text style={styles.title}>What&apos;s it paying?</Text>
      </View>
      <Text style={styles.figure}>
        {fmt(data.hourly.medianMin)}–{fmt(data.hourly.medianMax)}/hr
      </Text>
      <Text style={styles.caption}>
        Median posted pay for {data.tradeName ?? 'your trade'} in {data.state} · from {data.n}{' '}
        postings
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { ...typography.bodyBold, color: colors.navy },
  figure: { ...typography.h2, color: colors.navy, marginTop: spacing.xs },
  caption: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
});
