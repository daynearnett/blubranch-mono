// Mockup 7F — "Your job is live" confirmation.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ProgressDots } from '../../../src/components/ui.js';
import { usePostJob } from '../../../src/lib/post-job-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

export default function Published() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { draft, reset } = usePostJob();

  // Estimated reach is a rough placeholder — real numbers come from the
  // matcher in Phase 4.
  const reach = {
    workers: draft.boostPushNotification ? 312 : 80,
    views: 40,
    applicants: 12,
  };

  const onPostAnother = () => {
    reset();
    router.replace('/(app)/post-job/plan');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={6} current={5} />

          <View style={styles.successCircle}>
            <Text style={styles.successCheck}>✓</Text>
          </View>

          <Text style={styles.title}>Your job is live</Text>
          <Text style={styles.body}>
            {draft.title || 'Your listing'} at {draft.companyName || 'your company'} is now visible
            to tradespeople in the {draft.city || 'local'} area.
            {draft.boostPushNotification
              ? ' Push alerts have been sent to matching workers.'
              : ''}
          </Text>

          <Card style={styles.reachCard}>
            <Text style={styles.reachTitle}>Estimated reach</Text>
            <View style={styles.reachRow}>
              <Stat value={reach.workers} label="Workers notified" />
              <Stat value={`~${reach.views}`} label="Expected views" />
              <Stat value={`~${reach.applicants}`} label="Est. applicants" />
            </View>
          </Card>
        </View>

        <View>
          <Button label="Post another job" onPress={onPostAnother} />
          <Button
            variant="ctaDark"
            label="View applicant dashboard"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              reset();
              if (jobId) router.replace(`/(app)/applications/${jobId}`);
              else router.replace('/(app)/(tabs)/jobs');
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: spacing.xl,
  },
  successCheck: { color: colors.textInverse, fontSize: 48, lineHeight: 52 },
  title: {
    ...typography.h1,
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  reachCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  reachTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  reachRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { ...typography.h3, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
