// Mockup 7A — Choose plan
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PLAN_LABELS } from '@blubranch/shared';
import { Badge, Button, ProgressDots } from '../../../src/components/ui.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const PLANS = [
  {
    id: 'basic' as const,
    title: 'Basic',
    price: '$19 per post',
    bullets: ['Listed in local feed', 'Quick Apply', 'Applicant dashboard'],
  },
  {
    id: 'pro' as const,
    title: 'Blu',
    price: '$79 / month',
    badge: 'Most popular',
    bullets: [
      'All Basic features',
      'Unlimited Blu job posts',
      'Featured top placement',
      'Urgent badge',
      'Applicant analytics',
    ],
  },
  {
    id: 'unlimited' as const,
    title: 'Blu Max',
    price: '$139 / month',
    bullets: [
      'All Blu features',
      'Push alerts to matching workers',
      'Unlimited posts',
      'Direct message applicants',
      'Priority support',
    ],
  },
];

export default function ChoosePlan() {
  const router = useRouter();
  const { draft, update } = usePostJob();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={6} current={0} />
          <Text style={styles.title}>Choose a plan</Text>
          <Text style={styles.subtitle}>Step 1 of 6</Text>

          {PLANS.map((p) => {
            const active = draft.planTier === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => update({ planTier: p.id })}
                style={[styles.planCard, active && styles.planCardActive]}
              >
                <View style={styles.planHeaderRow}>
                  <Text style={styles.planTitle}>{p.title}</Text>
                  {p.badge ? <Badge label={p.badge} tone="primary" /> : null}
                </View>
                <Text style={styles.planPrice}>{p.price}</Text>
                {p.bullets.map((b) => (
                  <Text key={b} style={styles.planBullet}>
                    • {b}
                  </Text>
                ))}
              </Pressable>
            );
          })}
        </View>

        <View>
          <Button
            label={`Continue with ${PLAN_LABELS[draft.planTier]}`}
            onPress={() => router.push('/(app)/post-job/company')}
          />
          <Text style={styles.helper}>30-day money back guarantee · Cancel anytime</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  planCard: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.chipBgActive },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  planTitle: { ...typography.h3, color: colors.primaryDark },
  planPrice: { ...typography.bodyBold, color: colors.primary, marginBottom: spacing.sm },
  planBullet: { ...typography.body, color: colors.textPrimary, marginBottom: 2 },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
