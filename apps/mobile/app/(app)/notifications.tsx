// In-app notifications inbox. The backend already creates + pushes
// notifications (connection requests/accepts, messages, application status,
// job matches, profile views) — this surfaces them. Opening the screen marks
// them read so the header bell badge clears.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  Briefcase,
  Eye,
  MessageSquare,
  UserPlus,
} from 'lucide-react-native';
import { notifications as notificationsApi, type NotificationItem } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

function iconFor(type: string) {
  if (type.startsWith('connection')) return UserPlus;
  if (type === 'message') return MessageSquare;
  if (type === 'job_match' || type === 'application_status') return Briefcase;
  if (type === 'profile_view') return Eye;
  return Bell;
}

function routeFor(n: NotificationItem): string | null {
  const data = n.data ?? {};
  if (n.type.startsWith('connection')) return '/(app)/(tabs)/network';
  if (n.type === 'message') return '/(app)/messages';
  if (n.type === 'job_match' && typeof data.jobId === 'string') return `/(app)/jobs/${data.jobId}`;
  if (n.type === 'job_match' || n.type === 'application_status') return '/(app)/(tabs)/jobs';
  if (n.type === 'profile_view' || n.type === 'profile_nudge') return '/(app)/(tabs)/profile';
  return null;
}

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setItems(res.notifications);
    } catch {
      // leave whatever we have
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
      // Clear the unread badge once the user has opened the inbox.
      notificationsApi.markAllRead().catch(() => {});
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onPressItem = (n: NotificationItem) => {
    const route = routeFor(n);
    if (route) router.push(route as never);
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.orange} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bell color={colors.textMuted} size={32} strokeWidth={1.5} />
              <Text style={styles.emptyText}>You're all caught up.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const Icon = iconFor(item.type);
            const unread = !item.readAt;
            return (
              <Pressable
                style={[styles.row, unread && styles.rowUnread]}
                onPress={() => onPressItem(item)}
              >
                <View style={styles.iconWrap}>
                  <Icon color={colors.orange} size={20} strokeWidth={2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
                  <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowUnread: { backgroundColor: colors.surface, borderColor: colors.borderSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyBold, color: colors.navy },
  rowBody: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  rowTime: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
});
