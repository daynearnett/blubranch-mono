import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Search as SearchIcon, Trash2, X } from 'lucide-react-native';
import { Chip } from '../../src/components/ui.js';
import { VerifiedBadge } from '../../src/components/verified-badge.js';
import { search, type RecentSearch } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

type Tab = 'jobs' | 'people';

const TRENDING = ['Electrician', 'Plumber', 'HVAC', 'Welder', 'Carpenter', 'Foreman'];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('jobs');
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [results, setResults] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    search.recent().then(setRecent).catch(() => {});
  }, []);

  const doSearch = useCallback(async (q: string, t: Tab) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await search.query({ q: q.trim(), tab: t });
      setResults(res.items);
      setTotal(res.total);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = () => doSearch(query, tab);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (query.trim()) doSearch(query, t);
  };

  const handleRecentTap = (q: string) => {
    setQuery(q);
    doSearch(q, tab);
  };

  const handleTrendingTap = (q: string) => {
    setQuery(q);
    doSearch(q, tab);
  };

  const handleDeleteRecent = async (id: string) => {
    setRecent((prev) => prev.filter((r) => r.id !== id));
    await search.deleteRecent(id).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.searchBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <View style={styles.searchInputWrap}>
          <SearchIcon color={colors.textMuted} size={16} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs, people, trades..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoFocus
            autoCapitalize="none"
          />
          {query ? (
            <Pressable onPress={() => { setQuery(''); setSearched(false); setResults([]); }}>
              <X color={colors.textMuted} size={16} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {searched ? (
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === 'jobs' && styles.tabActive]}
            onPress={() => handleTabChange('jobs')}
          >
            <Text style={[styles.tabLabel, tab === 'jobs' && styles.tabLabelActive]}>Jobs</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'people' && styles.tabActive]}
            onPress={() => handleTabChange('people')}
          >
            <Text style={[styles.tabLabel, tab === 'people' && styles.tabLabelActive]}>People</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {!searched ? (
          <View>
            {recent.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent searches</Text>
                {recent.map((r) => (
                  <View key={r.id} style={styles.recentRow}>
                    <Pressable style={styles.recentTap} onPress={() => handleRecentTap(r.query)}>
                      <Clock color={colors.textMuted} size={16} strokeWidth={1.8} />
                      <Text style={styles.recentText}>{r.query}</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteRecent(r.id)} style={styles.recentDelete}>
                      <Trash2 color={colors.textMuted} size={14} strokeWidth={1.8} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending</Text>
              <View style={styles.trendingRow}>
                {TRENDING.map((t) => (
                  <Chip key={t} label={t} onPress={() => handleTrendingTap(t)} />
                ))}
              </View>
            </View>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.orange} style={styles.loader} />
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <SearchIcon color={colors.textMuted} size={32} strokeWidth={1.5} />
            <Text style={styles.emptyText}>
              No results for "{query}". Try different keywords.
            </Text>
          </View>
        ) : tab === 'jobs' ? (
          <View>
            <Text style={styles.resultCount}>{total} job{total !== 1 ? 's' : ''} found</Text>
            {(results as Array<{ id: string; title: string; city: string; state: string; payMin: number; payMax: number; company: { name: string } }>).map((job) => (
              <Pressable
                key={job.id}
                style={styles.resultRow}
                onPress={() => router.push(`/jobs/${job.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{job.title}</Text>
                  <Text style={styles.resultSub}>
                    {job.company.name} · {job.city}, {job.state}
                  </Text>
                  <Text style={styles.resultPay}>
                    ${job.payMin}–${job.payMax}/hr
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.resultCount}>{total} {total !== 1 ? 'people' : 'person'} found</Text>
            {(results as Array<{ id: string; firstName: string; lastName: string; profilePhotoUrl: string | null; isVerified: boolean; headline: string | null; trade: string | null }>).map((person) => (
              <Pressable
                key={person.id}
                style={styles.resultRow}
                onPress={() => router.push(`/users/${person.id}`)}
              >
                {person.profilePhotoUrl ? (
                  <Image source={{ uri: person.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>
                      {`${person.firstName[0]}${person.lastName[0]}`.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.resultTitle}>
                      {person.firstName} {person.lastName}
                    </Text>
                    {person.isVerified ? <VerifiedBadge size="mini" /> : null}
                  </View>
                  <Text style={styles.resultSub} numberOfLines={1}>
                    {person.headline || person.trade || ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.orange },
  tabLabel: { ...typography.bodyBold, color: colors.textMuted },
  tabLabelActive: { color: colors.orange },
  content: { padding: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recentTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recentText: { ...typography.body, color: colors.textPrimary },
  recentDelete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  trendingRow: { flexDirection: 'row', flexWrap: 'wrap' },
  loader: { marginTop: spacing.xxl },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
  resultCount: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  resultTitle: { ...typography.bodyBold, color: colors.navy },
  resultSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  resultPay: { ...typography.small, color: colors.orange, fontWeight: '600', marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  avatarInitials: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
});
