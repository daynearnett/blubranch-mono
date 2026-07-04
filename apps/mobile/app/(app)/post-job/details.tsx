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
import type { JobType } from '@blubranch/shared';
import { Button, Chip, Input, ProgressDots } from '../../../src/components/ui.js';
import { StatePicker } from '../../../src/components/state-picker.js';
import { reference } from '../../../src/lib/api.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const TYPE_OPTIONS: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temp_to_hire', label: 'Temp-to-hire' },
];

// Standard experience bands (years). Stored as the label string on the job.
const EXPERIENCE_OPTIONS = [
  '0–2 years',
  '3–5 years',
  '6–10 years',
  '11–15 years',
  '16–20 years',
  '20+ years',
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

  // Multi-select: keep the first pick as the primary tradeId/jobType.
  const toggleTrade = (id: number) => {
    const next = draft.tradeIds.includes(id)
      ? draft.tradeIds.filter((x) => x !== id)
      : [...draft.tradeIds, id];
    update({ tradeIds: next, tradeId: next[0] ?? null });
  };
  const toggleType = (value: JobType) => {
    const next = draft.jobTypes.includes(value)
      ? draft.jobTypes.filter((x) => x !== value)
      : [...draft.jobTypes, value];
    update({ jobTypes: next, jobType: next[0] ?? draft.jobType });
  };
  const otherSelected = trades.some((t) => draft.tradeIds.includes(t.id) && t.name === 'Other');

  const onContinue = () => {
    if (
      !draft.title.trim() ||
      draft.tradeIds.length === 0 ||
      !draft.jobTypes.length ||
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
    if (otherSelected && !draft.tradeOther.trim()) {
      setError('Enter the trade for "Other".');
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

            <Text style={styles.fieldLabel}>Trade(s) required</Text>
            <View style={styles.chipWrap}>
              {trades.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  active={draft.tradeIds.includes(t.id)}
                  onPress={() => toggleTrade(t.id)}
                />
              ))}
            </View>
            {otherSelected ? (
              <Input
                label="Which trade?"
                placeholder="Type the trade"
                value={draft.tradeOther}
                onChangeText={(v) => update({ tradeOther: v })}
              />
            ) : null}

            <Text style={styles.fieldLabel}>Experience level</Text>
            <View style={styles.chipWrap}>
              {EXPERIENCE_OPTIONS.map((o) => (
                <Chip
                  key={o}
                  label={o}
                  active={draft.experienceLevel === o}
                  onPress={() => update({ experienceLevel: o })}
                />
              ))}
            </View>

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

            <Text style={styles.fieldLabel}>Job type(s)</Text>
            <View style={styles.chipWrap}>
              {TYPE_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={draft.jobTypes.includes(o.value)}
                  onPress={() => toggleType(o.value)}
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
              <StatePicker
                value={draft.state}
                onChange={(abbr) => update({ state: abbr })}
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
