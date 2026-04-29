// Mockup 7C — Job details (title, trade, pay, type, setting, location, openings, description)
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JobType, WorkSetting } from '@blubranch/shared';
import { Button, Chip, Input, ProgressDots } from '../../../src/components/ui.js';
import { reference } from '../../../src/lib/api.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temp_to_hire', label: 'Temp-to-hire' },
];

const SETTING_OPTIONS: { value: WorkSetting; label: string }[] = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'mixed', label: 'Mixed' },
];

export default function JobDetails() {
  const router = useRouter();
  const { draft, update } = usePostJob();
  const [trades, setTrades] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reference
      .trades()
      .then(setTrades)
      .catch(() => undefined);
  }, []);

  const onContinue = () => {
    if (
      !draft.title.trim() ||
      !draft.tradeId ||
      !draft.experienceLevel.trim() ||
      !draft.payMin.trim() ||
      !draft.payMax.trim() ||
      !draft.city.trim() ||
      !draft.state.trim() ||
      !draft.zipCode.trim() ||
      !draft.description.trim()
    ) {
      setError('Fill out every field.');
      return;
    }
    if (Number(draft.payMin) > Number(draft.payMax)) {
      setError('Min pay must be ≤ max pay.');
      return;
    }
    setError(null);
    router.push('/(app)/post-job/perks');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <ProgressDots count={6} current={2} />
            <Text style={styles.title}>Job details</Text>
            <Text style={styles.subtitle}>Step 3 of 6</Text>

            <Input
              label="Job title"
              value={draft.title}
              onChangeText={(v) => update({ title: v })}
            />

            <Text style={styles.fieldLabel}>Trade required</Text>
            <View style={styles.chipWrap}>
              {trades.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  active={draft.tradeId === t.id}
                  onPress={() => update({ tradeId: t.id })}
                />
              ))}
            </View>

            <Input
              label="Experience level"
              placeholder="e.g. Journeyman (4–10 yrs)"
              value={draft.experienceLevel}
              onChangeText={(v) => update({ experienceLevel: v })}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input
                label="Pay min ($/hr)"
                keyboardType="decimal-pad"
                value={draft.payMin}
                onChangeText={(v) => update({ payMin: v })}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Pay max ($/hr)"
                keyboardType="decimal-pad"
                value={draft.payMax}
                onChangeText={(v) => update({ payMax: v })}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Text style={styles.fieldLabel}>Job type</Text>
            <View style={styles.chipWrap}>
              {TYPE_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={draft.jobType === o.value}
                  onPress={() => update({ jobType: o.value })}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Work setting</Text>
            <View style={styles.chipWrap}>
              {SETTING_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={draft.workSetting === o.value}
                  onPress={() => update({ workSetting: o.value })}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Job location</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input
                label="City"
                value={draft.city}
                onChangeText={(v) => update({ city: v })}
                containerStyle={{ flex: 2 }}
              />
              <Input
                label="State"
                value={draft.state}
                onChangeText={(v) => update({ state: v })}
                autoCapitalize="characters"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="ZIP"
                keyboardType="number-pad"
                value={draft.zipCode}
                onChangeText={(v) => update({ zipCode: v })}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Input
              label="Number of openings"
              keyboardType="number-pad"
              value={String(draft.openingsCount)}
              onChangeText={(v) => update({ openingsCount: Math.max(1, Number(v) || 1) })}
            />

            <Text style={styles.fieldLabel}>Job description</Text>
            <TextInput
              value={draft.description}
              onChangeText={(v) => update({ description: v.slice(0, 1000) })}
              multiline
              numberOfLines={6}
              placeholder="What will the worker do day-to-day?"
              placeholderTextColor={colors.textSecondary}
              style={styles.textarea}
            />
            <Text style={styles.charCount}>{draft.description.length} / 1000</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  fieldLabel: {
    ...typography.small,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  error: { ...typography.small, color: colors.danger, marginTop: spacing.md },
});
