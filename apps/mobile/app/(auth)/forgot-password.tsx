import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../../src/components/ui.js';
import { auth, ApiError } from '../../src/lib/api.js';
import { colors, spacing, typography } from '../../src/theme.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const router = useRouter();
  const { email: prefillEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof prefillEmail === 'string' ? prefillEmail : '');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendCode = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      const res = await auth.forgotPassword(trimmed);
      setCodeSent(true);
      setResendCooldown(30);
      if (res.devCode) setCode(res.devCode);
    } catch (err) {
      setError(
        err instanceof ApiError && err.message !== 'ValidationError'
          ? err.message
          : 'Could not send the reset email. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await auth.resetPassword(email.trim(), code.trim(), newPassword);
      Alert.alert('Password updated', 'Log in with your new password.', [
        {
          text: 'Log in',
          onPress: () =>
            router.replace({ pathname: '/(auth)/login', params: { email: email.trim() } }),
        },
      ]);
    } catch (err) {
      setError(
        err instanceof ApiError && err.message !== 'ValidationError'
          ? err.message
          : 'Reset failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
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
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              {codeSent
                ? `We sent a 6-digit code to ${email.trim()}. Enter it below with your new password.`
                : "Enter your email and we'll send you a code to reset your password."}
            </Text>

            <Input
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              editable={!codeSent}
            />

            {codeSent ? (
              <>
                <Input
                  label="6-digit code"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t);
                    if (error) setError(null);
                  }}
                />
                <Input
                  label="New password"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    if (error) setError(null);
                  }}
                  helper="At least 8 characters"
                />
              </>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <View>
            {codeSent ? (
              <>
                <Button label="Set new password" onPress={submitReset} loading={submitting} />
                <Button
                  variant="ghost"
                  label={resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                  onPress={sendCode}
                  disabled={resendCooldown > 0 || submitting}
                />
              </>
            ) : (
              <Button label="Send code" onPress={sendCode} loading={submitting} />
            )}
            <Button variant="ghost" label="Back to log in" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: { ...typography.h1, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  errorText: { ...typography.small, color: colors.danger, marginTop: spacing.xs },
});
