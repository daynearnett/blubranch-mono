// Mockup 7E — Review & publish. Creates the company (or reuses existing),
// then creates the job, then advances to the confirmation screen.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompanySize } from '@blubranch/shared';
import { Button, Card, ProgressDots } from '../../../src/components/ui.js';
import { ApiError, companies as companiesApi, jobs as jobsApi } from '../../../src/lib/api.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const PRICE: Record<'basic' | 'pro' | 'unlimited', string> = {
  basic: '$49 one-time',
  pro: '$129 one-time',
  unlimited: '$299 / month',
};

export default function Review() {
  const router = useRouter();
  const { draft } = usePostJob();
  const [submitting, setSubmitting] = useState(false);

  const ttlDays = draft.planTier === 'basic' ? 30 : 60;

  const onPublish = async () => {
    setSubmitting(true);
    try {
      // 1. Reuse or create the company.
      const existing = await companiesApi.myCompany().catch(() => null);
      let companyId = existing?.id;
      if (!companyId) {
        const created = await companiesApi.create({
          name: draft.companyName,
          industry: draft.industry || null,
          sizeRange: draft.companySize as CompanySize,
          website: draft.website || null,
          description: draft.about || null,
          contactEmail: draft.contactEmail,
        });
        companyId = created.id;
      } else {
        // Light update to keep contact email in sync.
        await companiesApi
          .update(existing!.id, {
            name: draft.companyName,
            industry: draft.industry || null,
            sizeRange: draft.companySize as CompanySize,
            website: draft.website || null,
            description: draft.about || null,
            contactEmail: draft.contactEmail,
          })
          .catch(() => undefined);
      }

      // 2. Create the job. Stripe payment is mocked — server will create
      //    in 'open' status immediately.
      const created = await jobsApi.create({
        companyId,
        title: draft.title,
        tradeId: draft.tradeId!,
        experienceLevel: draft.experienceLevel,
        payMin: Number(draft.payMin),
        payMax: Number(draft.payMax),
        jobType: draft.jobType,
        workSetting: draft.workSetting,
        city: draft.city,
        state: draft.state,
        zipCode: draft.zipCode,
        description: draft.description,
        openingsCount: draft.openingsCount,
        planTier: draft.planTier,
        isUrgent: draft.isUrgent,
        boostPushNotification: draft.boostPushNotification,
        boostFeaturedPlacement: draft.boostFeaturedPlacement,
        benefitIds: draft.benefitIds,
        status: 'open',
      });

      router.replace({ pathname: '/(app)/post-job/published', params: { jobId: created.id } });
    } catch (err) {
      Alert.alert('Could not publish', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={6} current={4} />
          <Text style={styles.title}>Review & publish</Text>
          <Text style={styles.subtitle}>Step 5 of 6</Text>

          <Card>
            <Text style={typography.h3}>{draft.title || 'Untitled job'}</Text>
            <Row label="Company" value={draft.companyName || '—'} />
            <Row
              label="Pay"
              value={`$${draft.payMin || '—'}–$${draft.payMax || '—'} / hr`}
            />
            <Row label="Type" value={prettyType(draft.jobType)} />
            <Row label="Setting" value={prettySetting(draft.workSetting)} />
            <Row
              label="Location"
              value={`${draft.city}, ${draft.state} ${draft.zipCode}`}
            />
            <Row label="Openings" value={String(draft.openingsCount)} />
          </Card>

          <Text style={styles.sectionTitle}>Boosts active</Text>
          <Card>
            <Bool label="Urgent badge" value={draft.isUrgent} />
            <Bool label="Push notification blast" value={draft.boostPushNotification} />
            <Bool label="Featured top placement" value={draft.boostFeaturedPlacement} />
            <Row label="Listing duration" value={`${ttlDays} days`} />
          </Card>

          <Text style={styles.sectionTitle}>Pricing</Text>
          <Card style={styles.priceCard}>
            <Text style={typography.h3}>{prettyPlan(draft.planTier)}</Text>
            <Text style={styles.subtle}>
              All boosts included · {ttlDays} days
            </Text>
            <Text style={styles.price}>{PRICE[draft.planTier]}</Text>
          </Card>

          <Text style={styles.legal}>
            By publishing you agree to BluBranch's Employer Terms. No refunds after job goes live.
          </Text>
        </View>

        <View>
          <Button
            variant="ctaDark"
            label={`Pay ${PRICE[draft.planTier].split(' ')[0]} & publish job`}
            onPress={onPublish}
            loading={submitting}
          />
          <Button
            variant="ghost"
            label="Go back and edit"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Bool({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ? '✓' : '—'}</Text>
    </View>
  );
}

function prettyType(t: string) {
  return t === 'full_time'
    ? 'Full-time'
    : t === 'part_time'
      ? 'Part-time'
      : t === 'contract'
        ? 'Contract'
        : 'Temp-to-hire';
}
function prettySetting(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function prettyPlan(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  subtle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  priceCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  price: { ...typography.h3, color: colors.primary },
  legal: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
});
