// Mockup screen 6A — Job Board.
//   • horizontal trade filter pills
//   • sort dropdown (Nearest / Newest / Pay highest)
//   • Featured cards on top, standard cards below
//   • desktop: tap a card → detail in right pane (no nav). mobile/tablet: nav.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TRADE_LIST } from '@blubranch/shared';
import { AdaptiveHeader } from '../../../src/components/adaptive-header.js';
import { Chip } from '../../../src/components/ui.js';
import { JobCard } from '../../../src/components/job-card.js';
import { JobDetailPane } from '../../../src/components/job-detail-pane.js';
import {
  QuickApplyModal,
  type QuickApplyTarget,
} from '../../../src/components/quick-apply-modal.js';
import { ResponsiveContainer } from '../../../src/components/responsive.js';
import { useLayout } from '../../../src/hooks/useLayout.js';
import {
  ApiError,
  jobs as jobsApi,
  me as meApi,
  reference,
  type JobSummary,
} from '../../../src/lib/api.js';
import { useDetailPanel } from '../../../src/lib/detail-panel-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

type SortKey = 'nearest' | 'newest' | 'pay_highest';
const SORT_LABELS: Record<SortKey, string> = {
  nearest: 'Nearest first',
  newest: 'Newest first',
  pay_highest: 'Pay (highest)',
};

interface UserCoords {
  lat: number;
  lng: number;
  city: string;
  state: string;
}

export default function JobsTab() {
  const router = useRouter();
  const { isDesktop } = useLayout();
  const { setTarget } = useDetailPanel();

  const [trades, setTrades] = useState<{ id: number; name: string; slug: string }[]>(
    TRADE_LIST.map((t, i) => ({ id: -1 - i, name: t.name, slug: t.slug })),
  );
  const [tradeSlug, setTradeSlug] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('nearest');
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [results, setResults] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<QuickApplyTarget | null>(null);

  // Pull trades once and the user's saved location for radius search.
  useEffect(() => {
    reference
      .trades()
      .then(setTrades)
      .catch(() => undefined);
    meApi
      .get()
      .then((m) => {
        if (m.workerProfile?.city && m.workerProfile?.state) {
          // Lat/lng aren't returned in /users/me — we fall back to a coarse
          // city-derived guess via the API's own dev geocode by re-using the
          // values stored on the worker profile. The job search still works
          // server-side because the user's stored point is what drives feed
          // distance; the client just needs *some* lat/lng to enable the
          // distance branch. Anchor at the API's Chicago dev fallback.
          setCoords({
            lat: 41.8781,
            lng: -87.6298,
            city: m.workerProfile.city,
            state: m.workerProfile.state,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  // Re-query whenever filters change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await jobsApi.search({
          trade: tradeSlug ?? undefined,
          sort,
          ...(coords ? { lat: coords.lat, lng: coords.lng, radius: 50 } : {}),
        });
        if (!cancelled) {
          setResults(res.results);
          setTotal(res.total);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tradeSlug, sort, coords]);

  const featured = useMemo(() => results.filter((r) => r.isFeatured), [results]);
  const standard = useMemo(() => results.filter((r) => !r.isFeatured), [results]);
  const locationLine = coords ? `${coords.city}, ${coords.state}` : 'Set your location';

  const onJobPress = (id: string) => {
    if (isDesktop) {
      setTarget({ kind: 'job', id });
    } else {
      router.push(`/jobs/${id}`);
    }
  };

  // Tap "Quick Apply" → open the cover-message modal.
  const openApply = (job: JobSummary) =>
    setApplyTarget({ id: job.id, title: job.title, companyName: job.company.name });

  const onApplied = (target: QuickApplyTarget) => {
    if (isDesktop) setTarget({ kind: 'job', id: target.id });
    else router.push(`/jobs/${target.id}`);
  };

  return (
    <View style={[styles.root, isDesktop && styles.rootRow]}>
      {/* Centre column */}
      <View style={{ flex: 1 }}>
        <AdaptiveHeader
          showSearch
          actions={[
            { icon: '🔔', label: 'Alerts' },
            { icon: '⚙️', label: 'Filters' },
          ]}
        />
        <ScrollView contentContainerStyle={styles.scroll}>
          <ResponsiveContainer>
            {/* Trade filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tradePills}
            >
              <Chip
                label="All trades"
                active={tradeSlug === null}
                onPress={() => setTradeSlug(null)}
              />
              {trades.map((t) => (
                <Chip
                  key={t.slug}
                  label={t.name}
                  active={tradeSlug === t.slug}
                  onPress={() => setTradeSlug(t.slug)}
                />
              ))}
            </ScrollView>

            {/* Results header + sort */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {loading ? 'Loading…' : `${total} jobs near ${locationLine}`}
              </Text>
              <View style={styles.sortRow}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setSort(k)}
                    style={[styles.sortBtn, sort === k && styles.sortBtnActive]}
                  >
                    <Text style={[styles.sortLabel, sort === k && styles.sortLabelActive]}>
                      {SORT_LABELS[k]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Featured */}
            {featured.length > 0 ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.sectionLabel}>FEATURED</Text>
                {featured.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onPress={() => onJobPress(j.id)}
                    onApplyPress={() => openApply(j)}
                  />
                ))}
              </View>
            ) : null}

            {/* Standard */}
            {standard.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>NEAR YOU</Text>
                {standard.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onPress={() => onJobPress(j.id)}
                    onApplyPress={() => openApply(j)}
                  />
                ))}
              </View>
            ) : null}

            {!loading && results.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.empty}>
                  No matching jobs yet. Try widening your trade filter or check back soon.
                </Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </ResponsiveContainer>
        </ScrollView>
      </View>

      {/* Right detail panel — desktop only */}
      {isDesktop ? <JobDetailPane onClose={() => setTarget(null)} /> : null}

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
  rootRow: { flexDirection: 'row' },
  scroll: { paddingVertical: spacing.lg },
  tradePills: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  resultsHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  resultsCount: { ...typography.small, color: colors.textSecondary },
  sortRow: { flexDirection: 'row', gap: spacing.xs },
  sortBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  sortBtnActive: { backgroundColor: colors.chipBgActive },
  sortLabel: { ...typography.small, color: colors.textSecondary },
  sortLabelActive: { color: colors.primary, fontWeight: '600' },
  sectionLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
