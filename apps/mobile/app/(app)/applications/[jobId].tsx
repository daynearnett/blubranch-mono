// Employer applicant dashboard. Not in the mockups — simple list view.
// Tapping an applicant navigates to their public profile (Mockup 5A).
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ApplicationStatus } from '@blubranch/shared';
import { Badge, Card } from '../../../src/components/ui.js';
import {
  ApiError,
  jobs as jobsApi,
  type ApplicantSummary,
  type JobDetail,
} from '../../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'applied',
  'reviewed',
  'shortlisted',
  'hired',
  'rejected',
];

const STATUS_TONE: Record<ApplicationStatus, 'neutral' | 'success' | 'primary' | 'danger'> = {
  applied: 'neutral',
  reviewed: 'primary',
  shortlisted: 'success',
  hired: 'success',
  rejected: 'danger',
};

export default function ApplicantDashboard() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [apps, setApps] = useState<ApplicantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    Promise.all([jobsApi.get(jobId), jobsApi.applications(jobId)])
      .then(([j, a]) => {
        setJob(j);
        setApps(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, [jobId]);

  const setStatus = async (a: ApplicantSummary, status: ApplicationStatus) => {
    if (!jobId) return;
    const previous = a.status;
    setApps((cur) => cur.map((x) => (x.id === a.id ? { ...x, status } : x)));
    try {
      await jobsApi.setApplicationStatus(jobId, a.id, { status });
    } catch (err) {
      setApps((cur) => cur.map((x) => (x.id === a.id ? { ...x, status: previous } : x)));
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {job?.title ?? 'Applicants'}
          </Text>
          {job ? (
            <Text style={styles.headerSub}>
              {apps.length} applicant{apps.length === 1 ? '' : 's'} · {job.openingsCount} opening
              {job.openingsCount === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : apps.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>
              No applicants yet. They'll show up here as soon as the first worker hits Quick Apply.
            </Text>
          </View>
        ) : (
          apps.map((a) => (
            <Card key={a.id}>
              <Pressable
                onPress={() => router.push(`/(app)/users/${a.worker.id}`)}
                style={styles.applicantHeader}
              >
                {a.worker.profilePhotoUrl ? (
                  <Image source={{ uri: a.worker.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>
                      {`${a.worker.firstName[0] ?? ''}${a.worker.lastName[0] ?? ''}`.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodyBold}>
                    {a.worker.firstName} {a.worker.lastName}
                  </Text>
                  {a.worker.headline ? (
                    <Text style={styles.subtle} numberOfLines={1}>
                      {a.worker.headline}
                    </Text>
                  ) : null}
                  {a.worker.city ? (
                    <Text style={styles.subtle}>
                      {a.worker.city}, {a.worker.state}
                    </Text>
                  ) : null}
                </View>
                <Badge label={a.status} tone={STATUS_TONE[a.status]} />
              </Pressable>

              {a.message ? (
                <Text style={styles.message} numberOfLines={3}>
                  "{a.message}"
                </Text>
              ) : null}

              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(a, s)}
                    style={[styles.statusBtn, a.status === s && styles.statusBtnActive]}
                  >
                    <Text style={[styles.statusLabel, a.status === s && styles.statusLabelActive]}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  back: { fontSize: 32, color: colors.primaryDark, lineHeight: 32 },
  headerTitle: { ...typography.h3, color: colors.primaryDark },
  headerSub: { ...typography.caption, color: colors.textSecondary },
  scroll: { padding: spacing.lg },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  applicantHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { ...typography.bodyBold, color: colors.primaryDark },
  subtle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  message: {
    ...typography.body,
    color: colors.textPrimary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  statusBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusLabel: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  statusLabelActive: { color: colors.textInverse, fontWeight: '700' },
});
