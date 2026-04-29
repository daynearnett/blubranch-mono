// Mockup screen 6B — Job Detail (mobile/tablet). Sticky Quick Apply bar.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobDetailBody } from '../../../src/components/job-detail-body.js';
import { colors, spacing, typography } from '../../../src/theme.js';

export default function JobDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Job details</Text>
        <Pressable hitSlop={12} accessibilityLabel="Bookmark">
          <Text style={styles.bookmark}>🔖</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <JobDetailBody jobId={id} stickyApply />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h3, color: colors.primaryDark },
  back: { fontSize: 32, color: colors.primaryDark, lineHeight: 32 },
  bookmark: { fontSize: 22 },
});
