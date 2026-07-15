import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { auth } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const CODE_LENGTH = 6;

export default function SignupVerify() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    auth.sendVerificationEmail(draft.email).then(async (res) => {
      if (res.devCode) {
        setDigits(res.devCode.split(''));
        try {
          const { verified } = await auth.verifyEmailCode(draft.email, res.devCode);
          if (verified) {
            update({ emailVerified: true });
            router.push('/(auth)/signup-location');
          }
        } catch { /* user can still enter manually */ }
      }
    }).catch(() => {});
    setResendCooldown(30);
  }, [draft.email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    if (value.length > 1) {
      const chars = value.split('').slice(0, CODE_LENGTH);
      chars.forEach((c, i) => {
        if (index + i < CODE_LENGTH) next[index + i] = c;
      });
      setDigits(next);
      const focusIdx = Math.min(index + chars.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    } else {
      next[index] = value;
      setDigits(next);
      if (value && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    const code = next.join('');
    if (code.length === CODE_LENGTH && next.every((d) => d !== '')) {
      verifyCode(code);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (code: string) => {
    setVerifying(true);
    setError('');
    try {
      const { verified } = await auth.verifyEmailCode(draft.email, code);
      if (verified) {
        update({ emailVerified: true });
        router.push('/(auth)/signup-location');
      } else {
        setError('Invalid code. Please try again.');
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Invalid code. Please try again.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await auth.sendVerificationEmail(draft.email);
      setResendCooldown(30);
      Alert.alert('Code sent', `A new code was sent to ${draft.email}`);
    } catch {
      Alert.alert('Error', 'Could not send code. Please try again.');
    }
  };

  return (
    <SignupShell progress={45}>
      <View style={styles.content}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.email}>{draft.email}</Text>
        </Text>

        <View style={styles.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[styles.codeBox, digit ? styles.codeBoxFilled : null, error ? styles.codeBoxError : null]}
              value={digit}
              onChangeText={(v) => handleDigitChange(i, v)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              selectTextOnFocus
              editable={!verifying}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {verifying ? <Text style={styles.verifyingText}>Verifying...</Text> : null}

        <Pressable onPress={onResend} disabled={resendCooldown > 0} style={styles.resendBtn}>
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendTextDisabled]}>
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
      <View />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: spacing.xl },
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xxl },
  email: { fontWeight: '600', color: colors.navy },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    backgroundColor: colors.background,
  },
  codeBoxFilled: { borderColor: colors.navy },
  codeBoxError: { borderColor: colors.danger },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.md },
  verifyingText: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  resendBtn: { paddingVertical: spacing.sm },
  resendText: { ...typography.bodyBold, color: colors.navy },
  resendTextDisabled: { color: colors.textMuted },
});
