// Mockup screen 4 — Home Feed.
// Mixed timeline of social posts + nearby jobs (interleaved every 3rd item).
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError, feed, type FeedItem } from '../../../src/lib/api.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { AdaptiveHeader } from '../../../src/components/adaptive-header.js';
import { JobCard } from '../../../src/components/job-card.js';
import { PostCard } from '../../../src/components/post-card.js';
import { QuickApplyModal, type QuickApplyTarget } from '../../../src/components/quick-apply-modal.js';
import { ResponsiveContainer } from '../../../src/components/responsive.js';
import { colors, spacing, typography } from '../../../src/theme.js';

export default function FeedTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<QuickApplyTarget | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await feed.get(1);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Tap "Quick Apply" on a feed job card → open the cover-message modal.
  // The modal does the apply call itself; on success we navigate to detail
  // so the user lands on a page that confirms application status.
  const openApply = (target: QuickApplyTarget) => setApplyTarget(target);
  const onApplied = (target: QuickApplyTarget) => router.push(`/jobs/${target.id}`);

  return (
    <View style={styles.root}>
      <AdaptiveHeader
        showSearch
        actions={[
          { icon: '🔔', label: 'Alerts' },
          { icon: '✉️', label: 'Messages' },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ResponsiveContainer>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>
                Welcome{user ? `, ${user.firstName}` : ''}. Your feed will fill in as you connect
                with peers and jobs land in your area.
              </Text>
            </View>
          ) : (
            <View style={styles.feed}>
              {items.map((item, i) => {
                if (item.kind === 'post') {
                  return <PostCard key={`p-${item.data.id}`} post={item.data} />;
                }
                // Insert a "JOBS NEAR YOU" header before the first job each run.
                const showHeader =
                  i === 0 || items[i - 1]?.kind !== 'job';
                return (
                  <View key={`j-${item.data.id}`}>
                    {showHeader ? <Text style={styles.sectionLabel}>JOBS NEAR YOU</Text> : null}
                    <JobCard
                      job={{
                        id: item.data.id,
                        title: item.data.title,
                        payMin: item.data.payMin,
                        payMax: item.data.payMax,
                        jobType: item.data.jobType,
                        workSetting: item.data.workSetting,
                        city: item.data.city,
                        state: item.data.state,
                        zipCode: '',
                        experienceLevel: '',
                        openingsCount: 1,
                        planTier: 'basic',
                        isFeatured: item.data.isFeatured,
                        isUrgent: item.data.isUrgent,
                        createdAt: item.data.createdAt,
                        expiresAt: item.data.createdAt,
                        company: { ...item.data.company, logoUrl: null },
                        trade: { id: 0, name: item.data.trade.name, slug: item.data.trade.slug },
                        distanceMiles: item.data.distanceMiles,
                      }}
                      onPress={() => router.push(`/jobs/${item.data.id}`)}
                      onApplyPress={() =>
                        openApply({
                          id: item.data.id,
                          title: item.data.title,
                          companyName: item.data.company.name,
                        })
                      }
                      compact
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ResponsiveContainer>
      </ScrollView>

      <QuickApplyModal
        visible={applyTarget !== null}
        job={applyTarget}
        onClose={() => setApplyTarget(null)}
        onApplied={onApplied}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingVertical: spacing.lg },
  feed: { paddingHorizontal: spacing.lg },
  center: { paddingVertical: spacing.xxl, alignItems: 'center', paddingHorizontal: spacing.lg },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  sectionLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
});
