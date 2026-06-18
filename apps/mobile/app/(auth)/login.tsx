import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '../../src/components/ui.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { ApiError } from '../../src/lib/api.js';
import { colors, spacing, typography } from '../../src/theme.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async () => {
    setEmailError(null);
    setFormError(null);

    // Validate before hitting the API so a mis-autofilled value (e.g. iOS
    // suggesting a phone number for the email field) gets a clear, field-level
    // message instead of a raw server "ValidationError".
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return;
    }
    if (!password) {
      setFormError('Enter your password');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(trimmed, password);
    } catch (err) {
      if (err instanceof ApiError) {
        // Prefer a field-specific validation issue; fall back to the API's
        // human message (e.g. "Invalid credentials"); never show the raw code.
        const emailIssue = err.issues?.find((i) => i.path === 'email');
        if (emailIssue) {
          setEmailError('Enter a valid email address');
        } else if (err.message && err.message !== 'ValidationError') {
          setFormError(err.message);
        } else {
          setFormError('Check your email and password and try again.');
        }
      } else {
        setFormError('Sign-in failed. Please try again.');
      }
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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to your BluBranch account</Text>

            <Input
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (emailError) setEmailError(null);
              }}
              error={emailError ?? undefined}
            />
            <Input
              label="Password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (formError) setFormError(null);
              }}
              error={formError ?? undefined}
            />
          </View>

          <View>
            <Button label="Log in" onPress={onSubmit} loading={submitting} />
            <Button
              variant="ghost"
              label="Create a new account"
              onPress={() => router.replace('/(auth)/signup-name')}
            />
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
});
