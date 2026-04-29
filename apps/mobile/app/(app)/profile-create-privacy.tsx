// Mockup screen 3D — Profile creation step 4 of 4: Privacy & visibility
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ProgressDots, Toggle } from '../../src/components/ui.js';
import { ApiError, me, type MeResponse } from '../../src/lib/api.js';
import { colors, spacing, typography } from '../../src/theme.js';

const TOGGLES = [
  {
    key: 'openToWork',
    title: 'Open to work',
    helper: "Employers in your area can see you're available",
  },
  {
    key: 'showHourlyRate',
    title: 'Show hourly rate',
    helper: 'Only visible to employers, not other workers',
  },
  {
    key: 'showUnion',
    title: 'Show union affiliation',
    helper: 'Displayed as a badge on your posts and profile',
  },
  {
    key: 'financialTips',
    title: 'Financial wellness tips',
    helper: 'Receive trade-specific money and tax content in your feed',
  },
  {
    key: 'jobAlerts',
    title: 'Job alerts',
    helper: 'Push notifications for new jobs matching your trade & location',
  },
] as const;

type SettingsKey = (typeof TOGGLES)[number]['key'];

export default function ProfileCreatePrivacy() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    me.get()
      .then(setData)
      .catch((err) =>
        Alert.alert('Could not load profile', err instanceof ApiError ? err.message : 'Try again'),
      );
  }, []);

  const settings = data?.settings ?? {
    openToWork: true,
    showHourlyRate: false,
    showUnion: true,
    financialTips: true,
    jobAlerts: true,
  };

  const toggle = async (key: SettingsKey) => {
    if (!data) return;
    const next = { ...settings, [key]: !settings[key] };
    setData({ ...data, settings: next });
    try {
      await me.updateSettings({ [key]: next[key] });
    } catch (err) {
      Alert.alert('Could not update', err instanceof ApiError ? err.message : 'Try again');
      setData(data); // rollback
    }
  };

  const onFinish = async () => {
    setBusy(true);
    // Save once more for safety, then jump to profile.
    try {
      await me.updateSettings(settings);
      router.replace('/(app)/(tabs)/feed');
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={4} current={3} />
          <Text style={styles.title}>Privacy & visibility</Text>
          <Text style={styles.subtitle}>Step 4 of 4 — you can update these anytime</Text>

          {TOGGLES.map((t) => (
            <Card key={t.key} style={styles.row}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={typography.bodyBold}>{t.title}</Text>
                <Text style={styles.helper}>{t.helper}</Text>
              </View>
              <Toggle value={settings[t.key]} onValueChange={() => toggle(t.key)} />
            </Card>
          ))}

          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              Your profile is ready. You can update any of these settings anytime from your
              profile page.
            </Text>
          </View>
        </View>

        <Button
          variant="ctaDark"
          label="Take me to my feed"
          onPress={onFinish}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  callout: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 10,
    marginTop: spacing.md,
  },
  calloutText: { ...typography.small, color: colors.textSecondary },
});
