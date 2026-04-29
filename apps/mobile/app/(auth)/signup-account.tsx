// Mockup screen 2A — Sign up step 1 of 3: Account
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, ProgressDots } from '../../src/components/ui.js';
import { useSignup, type SignupRole } from '../../src/lib/signup-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function SignupAccount() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const [errors, setErrors] = useState<Partial<Record<keyof typeof draft, string>>>({});

  const onContinue = () => {
    const next: typeof errors = {};
    if (!draft.firstName.trim()) next.firstName = 'Required';
    if (!draft.lastName.trim()) next.lastName = 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email = 'Valid email required';
    if (draft.phone.replace(/\D/g, '').length < 7) next.phone = 'Valid phone required';
    if (draft.password.length < 8) next.password = 'Min 8 characters';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      router.push('/(auth)/signup-trade');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <ProgressDots count={3} current={0} />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Step 1 of 3</Text>

            <Input
              label="First name"
              value={draft.firstName}
              onChangeText={(v) => update({ firstName: v })}
              error={errors.firstName}
            />
            <Input
              label="Last name"
              value={draft.lastName}
              onChangeText={(v) => update({ lastName: v })}
              error={errors.lastName}
            />
            <Input
              label="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={draft.email}
              onChangeText={(v) => update({ email: v })}
              error={errors.email}
            />
            <Input
              label="Phone number"
              keyboardType="phone-pad"
              highlight
              helper="Used for job alerts — never shared publicly"
              value={draft.phone}
              onChangeText={(v) => update({ phone: v })}
              error={errors.phone}
            />
            <Input
              label="Password"
              secureTextEntry
              value={draft.password}
              onChangeText={(v) => update({ password: v })}
              error={errors.password}
            />

            <Text style={styles.fieldLabel}>I am a...</Text>
            <View style={styles.roleRow}>
              {(['worker', 'employer'] as SignupRole[]).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => update({ role })}
                  style={[styles.roleCard, draft.role === role && styles.roleCardActive]}
                >
                  <Text style={[styles.roleTitle, draft.role === role && styles.roleTitleActive]}>
                    {role === 'worker' ? 'Tradesperson / worker' : 'Employer / contractor'}
                  </Text>
                  <Text style={styles.roleHint}>
                    {role === 'worker' ? 'Always free' : 'Pays to post jobs'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.helper}>
              Employers pay to post jobs. Workers are always free.
            </Text>
          </View>

          <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.xl }} />
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
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  roleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.chipBgActive },
  roleTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  roleTitleActive: { color: colors.primaryDark },
  roleHint: { ...typography.caption, color: colors.textSecondary },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
