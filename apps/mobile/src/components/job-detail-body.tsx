// Mockup screen 6B body — used by both the full-screen mobile route
// and the desktop right pane.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button } from './ui.js';
import { QuickApplyModal } from './quick-apply-modal.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { ApiError, jobs as jobsApi, type JobDetail } from '../lib/api.js';

const STATUS_LABEL: Record<NonNullable<JobDetail['myApplication']>['status'], string> = {
  applied: 'Application sent',
  reviewed: 'Reviewed by employer',
  shortlisted: '✓ Shortlisted',
  hired: '🎉 Hired',
  rejected: 'Not selected',
};

const TYPE_LABEL = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temp_to_hire: 'Temp-to-hire',
} as const;

const SETTING_LABEL = {
  commercial: 'Commercial',
  residential: 'Residential',
  industrial: 'Industrial',
  mixed: 'Mixed',
} as const;

interface Props {
  jobId: string;
  /** Render the sticky-bottom Quick Apply button. The desktop pane uses inline. */
  stickyApply?: boolean;
}

export function JobDetailBody({ jobId, stickyApply }: Props) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setJob(null);
    setError(null);
    jobsApi
      .get(jobId)
      .then((j) => {
        if (!cancelled) setJob(j);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load job');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);
  const onApplied = async () => {
    // Refetch so the sticky CTA flips to the "Application sent" pill.
    try {
      const fresh = await jobsApi.get(jobId);
      setJob(fresh);
    } catch {
      /* leave optimistic state alone */
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const initials = job.company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const elapsed = relativeTime(new Date(job.createdAt));

  const applyBtn = job.myApplication ? (
    <View style={styles.appliedPill}>
      <Text style={styles.appliedText}>{STATUS_LABEL[job.myApplication.status]}</Text>
    </View>
  ) : (
    <Button label="Quick Apply" onPress={openModal} />
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.scroll, stickyApply && styles.scrollWithSticky]}>
        {/* Employer card */}
        <View style={styles.employerRow}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyAvatarText}>{initials || '·'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{job.company.name}</Text>
            <Text style={styles.subtle}>
              {job.city}, {job.state}
            </Text>
          </View>
          {typeof job.distanceMiles === 'number' ? (
            <Text style={styles.distance}>{job.distanceMiles.toFixed(1)} mi</Text>
          ) : null}
        </View>

        {/* Title + pay + tags */}
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.pay}>
          ${formatPay(job.payMin)}–${formatPay(job.payMax)} / hr
        </Text>
        <View style={styles.tagRow}>
          <Badge label={TYPE_LABEL[job.jobType]} tone="neutral" />
          <Badge label={SETTING_LABEL[job.workSetting]} tone="neutral" />
          {job.benefits.length > 0 ? (
            <Badge label={`${job.benefits.length} benefits`} tone="neutral" />
          ) : null}
          {job.isUrgent ? <Badge label="Urgent hire" tone="danger" /> : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Stat value={job.applicantCount} label="Applicants" />
          <Stat value={elapsed} label="Posted" />
          <Stat value={job.openingsCount} label="Openings" />
        </View>

        {/* About the role */}
        <Text style={styles.sectionTitle}>About the role</Text>
        <Text style={styles.body}>{job.description}</Text>

        {/* Requirements (parsed from description for now — Phase 4 may model
            these explicitly; mockup shows a bullet list) */}
        {job.experienceLevel ? (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            <Text style={styles.body}>{job.experienceLevel}</Text>
          </>
        ) : null}

        {/* Benefits */}
        {job.benefits.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Benefits</Text>
            <View style={styles.benefitsWrap}>
              {job.benefits.map((b) => (
                <Badge key={b.id} label={b.name} tone="primary" style={styles.benefitChip} />
              ))}
            </View>
          </>
        ) : null}

        {/* Employer card footer */}
        <Text style={styles.sectionTitle}>About the employer</Text>
        <View style={styles.employerCard}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyAvatarText}>{initials || '·'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{job.company.name}</Text>
            <Text style={styles.subtle}>Plan: {job.planTier}</Text>
          </View>
        </View>

        {!stickyApply ? <View style={{ marginTop: spacing.lg }}>{applyBtn}</View> : null}
      </View>

      {stickyApply ? (
        <View style={styles.stickyBar}>
          <View style={{ flex: 1 }}>{applyBtn}</View>
          <Pressable style={styles.bookmarkBtn} accessibilityLabel="Bookmark">
            <Text style={styles.bookmarkIcon}>🔖</Text>
          </Pressable>
        </View>
      ) : null}

      <QuickApplyModal
        visible={modalVisible}
        job={{ id: job.id, title: job.title, companyName: job.company.name }}
        onClose={closeModal}
        onApplied={onApplied}
      />
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatPay(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg },
  scrollWithSticky: { paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  error: { ...typography.body, color: colors.danger },
  employerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  companyAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyAvatarText: { color: colors.textInverse, fontWeight: '700' },
  companyName: { ...typography.bodyBold, color: colors.textPrimary },
  subtle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  distance: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  pay: { ...typography.h3, color: colors.primary, marginBottom: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  body: { ...typography.body, color: colors.textPrimary },
  benefitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  benefitChip: { marginRight: 0 },
  employerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  appliedPill: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  appliedText: { color: colors.textInverse, ...typography.bodyBold },
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookmarkBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkIcon: { fontSize: 22 },
});
