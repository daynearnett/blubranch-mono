// Mockup 7A — Choose plan
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, ProgressDots } from '../../../src/components/ui.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const PLANS = [
  {
    id: 'basic' as const,
    title: 'Basic',
    price: '$49 per post',
    bullets: [
      'Listed in local feed',
      'Quick Apply',
      'Applicant dashboard',
      'No featured placement',
    ],
  },
  {
    id: 'pro' as const,
    title: 'Pro',
    price: '$129 per post',
    badge: 'Most popular',
    bullets: [
      'Featured top placement',
      'Urgent badge',
      'Push alerts to matching workers',
      '60-day listing',
      'Applicant analytics',
    ],
  },
  {
    id: 'unlimited' as const,
    title: 'Unlimited',
    price: '$299 / month',
    bullets: [
      'Unlimited posts',
      'All Pro features',
      'Company profile page',
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
            label={`Continue with ${draft.planTier[0]?.toUpperCase()}${draft.planTier.slice(1)}`}
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
