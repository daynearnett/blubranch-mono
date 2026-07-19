import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { colors, spacing, typography } from '../../src/theme.js';

export default function SignupName() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onContinue = () => {
    const next: Record<string, string> = {};
    if (!draft.firstName.trim()) next.firstName = 'Required';
    if (!draft.lastName.trim()) next.lastName = 'Required';
    setErrors(next);
    if (Object.keys(next).length === 0) {
      router.push('/(auth)/signup-email');
    }
  };

  return (
    <SignupShell progress={15} showBack={false}>
      <View>
        <Text style={styles.title}>What's your name?</Text>
        <Text style={styles.subtitle}>This is the name people will see.</Text>

        <Input
          label="First name"
          value={draft.firstName}
          onChangeText={(v) => update({ firstName: v })}
          error={errors.firstName}
          autoFocus
        />
        <Input
          label="Last name"
          value={draft.lastName}
          onChangeText={(v) => update({ lastName: v })}
          error={errors.lastName}
        />
      </View>

      <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.xl }} />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
});
