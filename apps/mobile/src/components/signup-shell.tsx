import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { ProgressBar } from './progress-bar.js';
import { Logo } from './logo.js';
import { useSignup } from '../lib/signup-context.js';
import { colors, spacing } from '../theme.js';

interface SignupShellProps {
  children: ReactNode;
  progress: number;
  showBack?: boolean;
}

export function SignupShell({ children, progress, showBack = true }: SignupShellProps) {
  const router = useRouter();
  const { reset } = useSignup();

  const onDismiss = () => {
    Alert.alert(
      'Leave signup?',
      'Your progress will be saved. You can continue later.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            reset();
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.brandRow}>
        <Logo size={22} />
      </View>
      <View style={styles.header}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Back">
            <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        <ProgressBar progress={progress} style={styles.progressBar} />
        <Pressable onPress={onDismiss} style={styles.headerBtn} accessibilityLabel="Close">
          <X color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  brandRow: { alignItems: 'center', paddingTop: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: { flex: 1, marginHorizontal: spacing.sm },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
});
