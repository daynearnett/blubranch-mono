import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup, type SignupRole } from '../../src/lib/signup-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

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
        <Text style={styles.subtitle}>This is how you'll appear on BluBranch.</Text>

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
      </View>

      <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.xl }} />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
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
  roleCardActive: { borderColor: colors.orange, backgroundColor: colors.chipBgActive },
  roleTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  roleTitleActive: { color: colors.navy },
  roleHint: { ...typography.small, color: colors.textMuted },
});
