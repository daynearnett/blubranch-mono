import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, me } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

type Step = 'phone' | 'code';

/**
 * Phone verification screen for the job-apply gate.
 * Navigated to when POST /jobs/:id/apply returns PhoneVerificationRequired.
 *
 * Query params:
 * - returnTo: job ID to return to after verification (optional)
 * - hasPhone: 'true' if user already has a phone on file
 */
export default function VerifyPhoneScreen() {
  const { returnTo, hasPhone } = useLocalSearchParams<{
    returnTo?: string;
    hasPhone?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();

  const [step, setStep] = useState<Step>(hasPhone === 'true' ? 'code' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!phone.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      // First save the phone number to the user's profile.
      await me.updateWorkerProfile({ phone: phone.trim() } as never);

      const res = await auth.sendPhoneCode(phone.trim());
      if (res.devCode) setDevCode(res.devCode);
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const phoneToVerify = phone.trim() || user?.phone || '';
      const res = await auth.verifyPhoneCode(phoneToVerify, code);
      if (!res.verified) {
        setError('Invalid code. Please try again.');
        setLoading(false);
        return;
      }

      // Refresh user data so phoneVerified is updated.
      const freshUser = await me.get();
      if (user && setUser) {
        setUser({
          ...user,
          phone: freshUser.phone,
          isVerified: freshUser.isVerified,
        });
      }

      // Return to the job that triggered verification.
      if (returnTo) {
        router.replace(`/(app)/jobs/${returnTo}`);
      } else {
        router.back();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify your phone</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          {step === 'phone' ? (
            <Phone color={colors.orange} size={32} />
          ) : (
            <ShieldCheck color={colors.orange} size={32} />
          )}
        </View>

        {step === 'phone' ? (
          <>
            <Text style={styles.title}>Phone number required</Text>
            <Text style={styles.subtitle}>
              We verify every worker's phone so employers know you're real — and
              so they can actually reach you.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
              accessibilityLabel="Phone number"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, (!phone.trim() || loading) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={!phone.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Send verification code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {phone || user?.phone || 'your phone'}.
            </Text>

            {devCode && (
              <View style={styles.devBanner}>
                <Text style={styles.devText}>Dev mode — code: {devCode}</Text>
              </View>
            )}

            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              accessibilityLabel="Verification code"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.resendLink}
              onPress={() => {
                setCode('');
                setError(null);
                handleSendCode();
              }}
            >
              <Text style={styles.resendText}>Resend code</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.h2, color: colors.navy, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    width: '100%',
    marginBottom: spacing.lg,
    fontSize: 18,
  },
  codeInput: {
    ...typography.h2,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 56,
    width: 200,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontSize: 28,
    letterSpacing: 8,
  },
  button: {
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    height: 48,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: { backgroundColor: colors.surface },
  buttonText: { ...typography.bodyBold, color: colors.textInverse },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  devBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  devText: { ...typography.caption, color: '#92400E', fontWeight: '600' },
  resendLink: { marginTop: spacing.lg, padding: spacing.md },
  resendText: { ...typography.body, color: colors.navy, fontWeight: '600' },
});
