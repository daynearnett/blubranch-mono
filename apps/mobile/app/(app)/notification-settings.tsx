import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { me, notifications, type MeResponse } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

type Prefs = NonNullable<MeResponse['settings']>;
type PrefKey =
  | 'notifyMessages'
  | 'notifyConnectionRequests'
  | 'notifyApplicationStatus'
  | 'notifyJobMatch'
  | 'notifyProfileViews'
  | 'notifyProfileNudges'
  | 'notifyPostLikes'
  | 'notifyPostComments'
  | 'notifyMentions'
  | 'notifyLicenseExpiry'
  | 'notifyVouches';

const ROWS: { key: PrefKey; label: string; desc: string }[] = [
  { key: 'notifyMessages', label: 'Messages', desc: 'New direct messages' },
  { key: 'notifyConnectionRequests', label: 'Branches', desc: 'Requests and acceptances' },
  { key: 'notifyMentions', label: 'Tags', desc: 'When someone tags you in a post or comment' },
  { key: 'notifyPostLikes', label: 'Likes', desc: 'When someone likes your post' },
  { key: 'notifyPostComments', label: 'Comments', desc: 'When someone comments on your post' },
  { key: 'notifyVouches', label: 'Vouches', desc: 'When someone vouches for you' },
  { key: 'notifyLicenseExpiry', label: 'License reminders', desc: 'Before a license expires' },
  { key: 'notifyApplicationStatus', label: 'Application updates', desc: 'When an employer moves your application' },
  { key: 'notifyJobMatch', label: 'Job matches', desc: 'New jobs near you in your trade' },
  { key: 'notifyProfileViews', label: 'Profile views', desc: 'When someone checks you out' },
  { key: 'notifyProfileNudges', label: 'Profile tips', desc: 'Occasional reminders to complete your profile' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await me.get();
      setPrefs(res.settings);
    } catch {
      // silent — leave loading state; user can back out
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (key: PrefKey, value: boolean) => {
    if (!prefs) return;
    const previous = prefs[key];
    // Optimistic update
    setPrefs({ ...prefs, [key]: value });
    try {
      await notifications.updatePreferences({ [key]: value });
    } catch {
      // Revert on failure
      setPrefs((p) => (p ? { ...p, [key]: previous } : p));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      {loading || !prefs ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Push notifications</Text>
          <View style={styles.card}>
            {ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDesc}>{row.desc}</Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(v) => toggle(row.key, v)}
                  trackColor={{ false: colors.border, true: colors.orange }}
                  thumbColor={colors.cardBg}
                  ios_backgroundColor={colors.border}
                />
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>
            Turning these off stops push notifications for that type. In-app activity still appears in the app.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  loader: { flex: 1, justifyContent: 'center' },
  content: { padding: spacing.lg },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowText: { flex: 1 },
  rowLabel: { ...typography.body, color: colors.navy, fontWeight: '600' },
  rowDesc: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  footnote: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
    lineHeight: 18,
  },
});
