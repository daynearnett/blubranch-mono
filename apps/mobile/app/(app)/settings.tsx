import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  KeyRound,
  LogOut,
  MessageSquare,
  Phone,
  Shield,
  Trash2,
  User,
} from 'lucide-react-native';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const APP_VERSION = '0.0.3';

interface SettingsRow {
  key: string;
  icon: typeof User;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}

export default function Settings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account after a 7-day cooling period. You can cancel within that time by signing back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Not yet available', 'Account deletion will be available in a future update.');
          },
        },
      ],
    );
  };

  const accountSection: SettingsRow[] = [
    { key: 'profile', icon: User, label: 'Profile & visibility' },
    { key: 'security', icon: KeyRound, label: 'Sign in & security' },
    { key: 'phone', icon: Phone, label: 'Phone number' },
  ];

  const preferencesSection: SettingsRow[] = [
    {
      key: 'notifications',
      icon: Bell,
      label: 'Notifications',
      onPress: () => router.push('/(app)/notification-settings'),
    },
    { key: 'language', icon: Globe, label: 'Language' },
  ];

  const supportSection: SettingsRow[] = [
    { key: 'help', icon: HelpCircle, label: 'Help center' },
    { key: 'feedback', icon: MessageSquare, label: 'Send feedback' },
    { key: 'privacy', icon: Shield, label: 'Privacy policy' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          {accountSection.map((row) => (
            <RowItem key={row.key} row={row} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          {preferencesSection.map((row) => (
            <RowItem key={row.key} row={row} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          {supportSection.map((row) => (
            <RowItem key={row.key} row={row} />
          ))}
        </View>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          <LogOut color={colors.danger} size={18} strokeWidth={2} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Trash2 color={colors.textMuted} size={16} strokeWidth={2} />
          <Text style={styles.deleteLabel}>Delete account</Text>
        </Pressable>

        <Text style={styles.version}>BluBranch v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({ row }: { row: SettingsRow }) {
  const Icon = row.icon;
  return (
    <Pressable style={styles.row} onPress={row.onPress}>
      <Icon color={row.danger ? colors.danger : colors.navy} size={20} strokeWidth={1.8} />
      <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}>{row.label}</Text>
      <ChevronRight color={colors.textMuted} size={16} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, color: colors.navy },
  content: { padding: spacing.lg },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowLabelDanger: { color: colors.danger },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
  },
  signOutLabel: { ...typography.bodyBold, color: colors.danger },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteLabel: { ...typography.small, color: colors.textMuted },
  version: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
});
