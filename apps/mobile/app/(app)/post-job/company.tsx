// Mockup 7B — Company info
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompanySize } from '@blubranch/shared';
import { Button, Chip, Input, ProgressDots } from '../../../src/components/ui.js';
import { ApiError, companies as companiesApi } from '../../../src/lib/api.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, spacing, typography } from '../../../src/theme.js';

const SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: 'size_1_10', label: '1–10' },
  { value: 'size_11_50', label: '11–50' },
  { value: 'size_51_200', label: '51–200' },
  { value: 'size_201_500', label: '201–500' },
  { value: 'size_500_plus', label: '500+' },
];

export default function CompanyInfo() {
  const router = useRouter();
  const { draft, update, hydrateCompanyFromExisting } = usePostJob();
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from /users/me/company so an employer doesn't retype.
  useEffect(() => {
    companiesApi
      .myCompany()
      .then((c) => {
        if (c) hydrateCompanyFromExisting(c);
      })
      .catch(() => undefined);
  }, [hydrateCompanyFromExisting]);

  const onContinue = () => {
    if (!draft.companyName.trim() || !draft.contactEmail.trim() || !draft.companySize) {
      setError('Name, contact email, and size are required.');
      return;
    }
    setError(null);
    router.push('/(app)/post-job/details');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <ProgressDots count={6} current={1} />
            <Text style={styles.title}>About your company</Text>
            <Text style={styles.subtitle}>Step 2 of 6</Text>

            <Input
              label="Company name"
              value={draft.companyName}
              onChangeText={(v) => update({ companyName: v })}
            />
            <Input
              label="Industry / trade"
              value={draft.industry}
              onChangeText={(v) => update({ industry: v })}
            />

            <Text style={styles.fieldLabel}>Company size</Text>
            <View style={styles.chipWrap}>
              {SIZE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={`${opt.label} employees`}
                  active={draft.companySize === opt.value}
                  onPress={() => update({ companySize: opt.value })}
                />
              ))}
            </View>

            <Input
              label="Company website (optional)"
              autoCapitalize="none"
              value={draft.website}
              onChangeText={(v) => update({ website: v })}
            />
            <Input
              label="About your company"
              value={draft.about}
              onChangeText={(v) => update({ about: v.slice(0, 300) })}
              helper={`${draft.about.length} / 300`}
            />
            <Input
              label="Contact email for applicants"
              autoCapitalize="none"
              keyboardType="email-address"
              value={draft.contactEmail}
              onChangeText={(v) => update({ contactEmail: v })}
              helper="Not shown publicly — used to deliver applicant notifications"
              error={error ?? undefined}
            />
          </View>

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
});
