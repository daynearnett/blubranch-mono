import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, MessageSquare, Search, UserPlus, Users, X } from 'lucide-react-native';
import { TopSearchBar } from '../../../src/components/top-search-bar.js';
import { Button } from '../../../src/components/ui.js';
import { VerifiedBadge } from '../../../src/components/verified-badge.js';
import {
  connections,
  type ConnectionItem,
  type NetworkSuggestion,
  type PendingInvite,
} from '../../../src/lib/api.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

type SubTab = 'grow' | 'connections';

export default function NetworkTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('grow');
  const [refreshing, setRefreshing] = useState(false);

  // Grow data
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [suggestions, setSuggestions] = useState<NetworkSuggestion[]>([]);
  const [loadingGrow, setLoadingGrow] = useState(true);

  // Connections data
  const [connectionsList, setConnectionsList] = useState<ConnectionItem[]>([]);
  const [connectionsTotal, setConnectionsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConnections, setLoadingConnections] = useState(true);

  const loadGrow = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([connections.pending(), connections.suggestions()]);
      setPending(p);
      setSuggestions(s);
    } catch {
      // silent
    } finally {
      setLoadingGrow(false);
    }
  }, []);

  const loadConnections = useCallback(async (search?: string) => {
    try {
      const res = await connections.list({ search, sort: 'recent' });
      setConnectionsList(res.items);
      setConnectionsTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  useEffect(() => { loadGrow(); }, [loadGrow]);
  useEffect(() => { loadConnections(); }, [loadConnections]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (subTab === 'grow') await loadGrow();
    else await loadConnections(searchQuery || undefined);
    setRefreshing(false);
  };

  const handleAccept = async (id: string) => {
    try {
      await connections.accept(id);
      setPending((prev) => prev.filter((p) => p.connectionId !== id));
    } catch { /* silent */ }
  };

  const handleDecline = async (id: string) => {
    try {
      await connections.decline(id);
      setPending((prev) => prev.filter((p) => p.connectionId !== id));
    } catch { /* silent */ }
  };

  const handleConnect = async (userId: string) => {
    try {
      await connections.request({ receiverId: userId });
      setSuggestions((prev) => prev.filter((s) => s.id !== userId));
    } catch { /* silent */ }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setLoadingConnections(true);
    loadConnections(text || undefined);
  };

  return (
    <View style={styles.root}>
      <TopSearchBar
        avatarInitials={user ? `${user.firstName[0]}${user.lastName[0]}` : '??'}
        placeholder="Search people..."
      />

      <View style={styles.subTabBar}>
        <Pressable
          style={[styles.subTab, subTab === 'grow' && styles.subTabActive]}
          onPress={() => setSubTab('grow')}
        >
          <Text style={[styles.subTabLabel, subTab === 'grow' && styles.subTabLabelActive]}>
            Grow
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTab, subTab === 'connections' && styles.subTabActive]}
          onPress={() => setSubTab('connections')}
        >
          <Text style={[styles.subTabLabel, subTab === 'connections' && styles.subTabLabelActive]}>
            Branches ({connectionsTotal})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      >
        {subTab === 'grow' ? (
          loadingGrow ? (
            <ActivityIndicator color={colors.orange} style={styles.loader} />
          ) : (
            <GrowSection
              pending={pending}
              suggestions={suggestions}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onConnect={handleConnect}
              onViewProfile={(id) => router.push(`/users/${id}`)}
            />
          )
        ) : loadingConnections ? (
          <ActivityIndicator color={colors.orange} style={styles.loader} />
        ) : (
          <ConnectionsSection
            items={connectionsList}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            onViewProfile={(id) => router.push(`/users/${id}`)}
            onMessage={(userId) => router.push(`/(app)/new-chat/${userId}`)}
          />
        )}
      </ScrollView>
    </View>
  );
}

function GrowSection({
  pending,
  suggestions,
  onAccept,
  onDecline,
  onConnect,
  onViewProfile,
}: {
  pending: PendingInvite[];
  suggestions: NetworkSuggestion[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onConnect: (userId: string) => void;
  onViewProfile: (id: string) => void;
}) {
  return (
    <View>
      {pending.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Waiting on you ({pending.length})
          </Text>
          {pending.map((inv) => (
            <View key={inv.connectionId} style={styles.personRow}>
              <Pressable style={styles.personInfo} onPress={() => onViewProfile(inv.user.id)}>
                <Avatar user={inv.user} />
                <View style={styles.personText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.personName}>
                      {inv.user.firstName} {inv.user.lastName}
                    </Text>
                    {inv.user.isVerified ? <VerifiedBadge size="mini" /> : null}
                  </View>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {inv.user.headline || inv.user.trade || ''}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.inviteActions}>
                <Pressable style={styles.acceptBtn} onPress={() => onAccept(inv.connectionId)}>
                  <Check color={colors.textInverse} size={16} strokeWidth={2.5} />
                </Pressable>
                <Pressable style={styles.declineBtn} onPress={() => onDecline(inv.connectionId)}>
                  <X color={colors.textMuted} size={16} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>People you've probably crossed paths with</Text>
        {suggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={colors.textMuted} size={32} strokeWidth={1.5} />
            <Text style={styles.emptyText}>
              Add your trade and work history and we'll find people you've crossed paths with.
            </Text>
          </View>
        ) : (
          suggestions.map((person) => (
            <View key={person.id} style={styles.personRow}>
              <Pressable style={styles.personInfo} onPress={() => onViewProfile(person.id)}>
                <Avatar user={person} />
                <View style={styles.personText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.personName}>
                      {person.firstName} {person.lastName}
                    </Text>
                    {person.isVerified ? <VerifiedBadge size="mini" /> : null}
                  </View>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {person.headline || person.trade || ''}
                  </Text>
                  {person.city ? (
                    <Text style={styles.personLocation}>
                      {person.city}{person.state ? `, ${person.state}` : ''}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable style={styles.connectBtn} onPress={() => onConnect(person.id)}>
                <UserPlus color={colors.orange} size={16} strokeWidth={2} />
                <Text style={styles.connectLabel}>Connect</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function ConnectionsSection({
  items,
  searchQuery,
  onSearch,
  onViewProfile,
  onMessage,
}: {
  items: ConnectionItem[];
  searchQuery: string;
  onSearch: (text: string) => void;
  onViewProfile: (id: string) => void;
  onMessage: (userId: string) => void;
}) {
  return (
    <View>
      <View style={styles.searchBar}>
        <Search color={colors.textMuted} size={16} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search connections..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={onSearch}
          autoCapitalize="none"
        />
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Users color={colors.textMuted} size={32} strokeWidth={1.5} />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No connections match your search.' : 'No branches yet. Start with people you\'ve worked with.'}
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.connectionId}
            style={styles.personRow}
            onPress={() => onViewProfile(item.user.id)}
          >
            <Avatar user={item.user} />
            <View style={styles.personText}>
              <View style={styles.nameRow}>
                <Text style={styles.personName}>
                  {item.user.firstName} {item.user.lastName}
                </Text>
                {item.user.isVerified ? <VerifiedBadge size="mini" /> : null}
              </View>
              <Text style={styles.personSub} numberOfLines={1}>
                {item.user.headline || item.user.trade || ''}
              </Text>
            </View>
            <Pressable
              style={styles.quickMsgBtn}
              onPress={() => onMessage(item.user.id)}
              accessibilityLabel={`Message ${item.user.firstName}`}
              accessibilityRole="button"
            >
              <MessageSquare color={colors.orange} size={18} strokeWidth={2} />
            </Pressable>
          </Pressable>
        ))
      )}
    </View>
  );
}

function Avatar({ user }: { user: { firstName: string; lastName: string; profilePhotoUrl: string | null } }) {
  if (user.profilePhotoUrl) {
    return <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatar} />;
  }
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.orange,
  },
  subTabLabel: { ...typography.bodyBold, color: colors.textMuted },
  subTabLabelActive: { color: colors.navy },
  content: { padding: spacing.lg },
  loader: { marginTop: spacing.xxl },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  personInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  personText: { flex: 1, marginLeft: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  personName: { ...typography.bodyBold, color: colors.navy },
  personSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  personLocation: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  avatarInitials: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  connectLabel: { ...typography.small, color: colors.navy, fontWeight: '600' },
  quickMsgBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
