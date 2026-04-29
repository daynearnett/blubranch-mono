// Reusable job card. Used by:
//   - Home Feed (Mockup screen 4) — inline `JOBS NEAR YOU` block
//   - Job Board (Mockup screen 6A) — Featured + Standard rows
//   - Detail panel preview on desktop
//
// Featured variant adds an orange top stripe + "FEATURED" badge.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from './ui.js';
import { colors, radius, spacing, typography } from '../theme.js';
import type { FeedJobItem, JobSummary } from '../lib/api.js';

const TYPE_LABEL: Record<JobSummary['jobType'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temp_to_hire: 'Temp-to-hire',
};

const SETTING_LABEL: Record<JobSummary['workSetting'], string> = {
  commercial: 'Commercial',
  residential: 'Residential',
  industrial: 'Industrial',
  mixed: 'Mixed',
};

interface Props {
  job: JobSummary | FeedJobItem;
  onPress?: () => void;
  onApplyPress?: () => void;
  /** Override featured styling (e.g. inside the feed where every card is compact) */
  compact?: boolean;
}

export function JobCard({ job, onPress, onApplyPress, compact }: Props) {
  const featured = job.isFeatured && !compact;
  const initials = job.company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        featured && styles.cardFeatured,
        pressed && styles.cardPressed,
      ]}
    >
      {featured ? (
        <View style={styles.featuredStripe}>
          <Text style={styles.featuredText}>FEATURED</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyAvatarText}>{initials || '·'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{job.company.name}</Text>
            <Text style={styles.location}>
              {job.city}, {job.state}
            </Text>
          </View>
          {typeof job.distanceMiles === 'number' && job.distanceMiles >= 0 ? (
            <Text style={styles.distance}>{job.distanceMiles.toFixed(1)} mi away</Text>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>

        <Text style={styles.pay}>
          ${formatPay(job.payMin)}–${formatPay(job.payMax)} / hr
        </Text>

        <View style={styles.tagRow}>
          <Badge label={TYPE_LABEL[job.jobType]} tone="neutral" />
          <Badge label={SETTING_LABEL[job.workSetting]} tone="neutral" />
          {job.isUrgent ? <Badge label="Urgent hire" tone="danger" /> : null}
        </View>

        {onApplyPress ? (
          <Pressable
            onPress={onApplyPress}
            style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]}
          >
            <Text style={styles.applyLabel}>Quick Apply</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function formatPay(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardFeatured: { borderColor: colors.primary, borderWidth: 2 },
  cardPressed: { opacity: 0.85 },
  featuredStripe: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  featuredText: {
    color: colors.textInverse,
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  body: { padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  companyAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyAvatarText: { color: colors.textInverse, fontWeight: '700' },
  companyName: { ...typography.bodyBold, color: colors.textPrimary },
  location: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  distance: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  title: { ...typography.h3, color: colors.primaryDark, marginBottom: spacing.xs },
  pay: { ...typography.bodyBold, color: colors.primary, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  applyBtnPressed: { opacity: 0.85 },
  applyLabel: { color: colors.textInverse, fontWeight: '700' },
});
