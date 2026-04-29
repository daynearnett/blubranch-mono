import { Link, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function Welcome() {
  const router = useRouter();

  const stubSocial = (provider: 'apple' | 'google' | 'facebook') => () => {
    Alert.alert(
      'Social sign-in',
      `Continue with ${provider} — full provider flow lands in a later phase. Use email signup for now.`,
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoBlock}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>BB</Text>
          </View>
          <Text style={styles.brand}>BluBranch</Text>
          <Text style={styles.tagline}>The professional network built for the Blue Collar.</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Create a free account" onPress={() => router.push('/(auth)/signup-account')} />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </View>

          <Pressable style={styles.socialBtn} onPress={stubSocial('apple')}>
            <Text style={styles.socialLabel}>Continue with Apple</Text>
          </Pressable>
          <Pressable style={styles.socialBtn} onPress={stubSocial('google')}>
            <Text style={styles.socialLabel}>Continue with Google</Text>
          </Pressable>
          <Pressable style={styles.socialBtn} onPress={stubSocial('facebook')}>
            <Text style={styles.socialLabel}>Continue with Facebook</Text>
          </Pressable>

          <Button
            variant="outline"
            label="Log in to existing account"
            style={{ marginTop: spacing.md }}
            onPress={() => router.push('/(auth)/login')}
          />
        </View>

        <Text style={styles.legal}>
          By continuing you agree to BluBranch's{' '}
          <Link href="/" style={styles.link}>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/" style={styles.link}>
            Privacy Policy
          </Link>
          . <Text style={styles.legalBold}>Workers always free.</Text>
        </Text>
      </ScrollView>
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
  logoBlock: { alignItems: 'center', marginTop: spacing.xxl },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoMarkText: { ...typography.h1, color: colors.textInverse },
  brand: { ...typography.h1, color: colors.primaryDark, marginBottom: spacing.xs },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  actions: { marginTop: spacing.xxl },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md },
  socialBtn: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  socialLabel: { ...typography.bodyBold, color: colors.textPrimary },
  legal: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  legalBold: { fontWeight: '700', color: colors.primary },
  link: { textDecorationLine: 'underline', color: colors.textSecondary },
});
