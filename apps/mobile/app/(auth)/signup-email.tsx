import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Button, Input } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { ApiError, auth } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function SignupEmail() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const { register } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);

  const onContinue = async () => {
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email = 'Valid email required';
    if (draft.password.length < 8) next.password = 'Min 8 characters';
    if (!draft.termsAccepted) next.terms = 'You must accept the terms';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setChecking(true);
    try {
      const { available } = await auth.checkEmail(draft.email);
      if (!available) {
        setErrors({ email: 'An account with this email already exists' });
        Alert.alert(
          'You already have an account',
          `${draft.email} is already on BluBranch. Log in to pick up where you left off.`,
          [
            { text: 'Use a different email', style: 'cancel' },
            {
              text: 'Log in',
              onPress: () =>
                router.replace({ pathname: '/(auth)/login', params: { email: draft.email } }),
            },
          ],
        );
        return;
      }
      // Create the account here rather than at the end of the wizard. The
      // remaining steps (verify, import, location, trade) then run
      // authenticated, which is what lets the LinkedIn/resume import write
      // straight to the profile instead of staging everything in the draft.
      //
      // Re-entering this screen after a back-navigation must not register
      // twice — `accountCreated` short-circuits it.
      if (!draft.accountCreated) {
        await register({
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          password: draft.password,
          role: draft.role,
          termsAccepted: draft.termsAccepted,
        });
        update({ accountCreated: true });
      }
      router.push('/(auth)/signup-verify');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message && err.message !== 'ValidationError'
          ? err.message
          : "Couldn't create your account. Give it another shot.";
      Alert.alert('Signup failed', msg);
    } finally {
      setChecking(false);
    }
  };

  return (
    <SignupShell progress={30}>
      <View>
        <Text style={styles.title}>Set up your account</Text>
        <Text style={styles.subtitle}>We'll send a verification code to confirm your email.</Text>

        <Input
          label="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={draft.email}
          onChangeText={(v) => update({ email: v })}
          error={errors.email}
          autoFocus
        />
        <Input
          label="Password"
          secureTextEntry
          value={draft.password}
          onChangeText={(v) => update({ password: v })}
          error={errors.password}
          helper="At least 8 characters"
        />

        <Pressable
          style={styles.termsRow}
          onPress={() => update({ termsAccepted: !draft.termsAccepted })}
        >
          <View style={[styles.checkbox, draft.termsAccepted && styles.checkboxActive]}>
            {draft.termsAccepted && <Check color={colors.textInverse} size={14} strokeWidth={3} />}
          </View>
          <Text style={styles.termsText}>
            I agree to BluBranch's Terms of Service and Privacy Policy
          </Text>
        </Pressable>
        {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}
      </View>

      <Button
        label="Continue"
        onPress={onContinue}
        loading={checking}
        style={{ marginTop: spacing.xl }}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  termsText: { ...typography.small, color: colors.textMuted, flex: 1 },
  errorText: { ...typography.small, color: colors.danger, marginTop: spacing.xs, marginLeft: 30 },
});
