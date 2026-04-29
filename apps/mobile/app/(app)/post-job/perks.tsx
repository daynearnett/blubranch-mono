// Mockup 7D — Perks & boosts
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, ProgressDots, Toggle } from '../../../src/components/ui.js';
import { reference } from '../../../src/lib/api.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, spacing, typography } from '../../../src/theme.js';

export default function Perks() {
  const router = useRouter();
  const { draft, update } = usePostJob();
  const [benefits, setBenefits] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    reference
      .benefits()
      .then(setBenefits)
      .catch(() => undefined);
  }, []);

  const toggleBenefit = (id: number) => {
    update({
      benefitIds: draft.benefitIds.includes(id)
        ? draft.benefitIds.filter((b) => b !== id)
        : [...draft.benefitIds, id],
    });
  };

  // Pro/Unlimited gate — Basic gets greyed out boost toggles.
  const boostsEnabled = draft.planTier !== 'basic';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={6} current={3} />
          <Text style={styles.title}>Perks & boosts</Text>
          <Text style={styles.subtitle}>Step 4 of 6</Text>

          <Text style={styles.sectionTitle}>Benefits offered</Text>
          <View style={styles.chipWrap}>
            {benefits.map((b) => (
              <Chip
                key={b.id}
                label={b.name}
                active={draft.benefitIds.includes(b.id)}
                onPress={() => toggleBenefit(b.id)}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Listing boosts</Text>
          {!boostsEnabled ? (
            <Text style={styles.lockedHint}>
              Upgrade to Pro or Unlimited to unlock boosts.
            </Text>
          ) : null}

          <BoostRow
            title="Urgent hire badge"
            helper="Red badge drives 2× more applicants"
            value={draft.isUrgent}
            onValueChange={(v) => update({ isUrgent: v })}
            disabled={!boostsEnabled}
          />
          <BoostRow
            title="Push notification blast"
            helper="Alert all matching workers in your area"
            value={draft.boostPushNotification}
            onValueChange={(v) => update({ boostPushNotification: v })}
            disabled={!boostsEnabled}
          />
          <BoostRow
            title="Featured top placement"
            helper="Pin your post to the top of local results"
            value={draft.boostFeaturedPlacement}
            onValueChange={(v) => update({ boostFeaturedPlacement: v })}
            disabled={!boostsEnabled}
          />
          <BoostRow
            title="Boost to saved workers"
            helper="Upgrade to Unlimited to unlock"
            value={false}
            onValueChange={() => undefined}
            disabled
          />
        </View>

        <Button
          label="Continue"
          onPress={() => router.push('/(app)/post-job/review')}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function BoostRow({
  title,
  helper,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  helper: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Card style={[styles.row, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={typography.bodyBold}>{title}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>
      <Toggle value={value} onValueChange={(v) => !disabled && onValueChange(v)} />
    </Card>
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
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  lockedHint: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
