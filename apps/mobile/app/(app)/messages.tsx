import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messages, type ConversationPreview } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await messages.conversations();
      setConversations(res.conversations);
    } catch {
      // silent
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

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderConversation({ item }: { item: ConversationPreview }) {
    const { otherUser, lastMessage, unreadCount } = item;
    const initials = `${otherUser.firstName?.[0] ?? ''}${otherUser.lastName?.[0] ?? ''}`;

    return (
      <Pressable
        style={[styles.row, unreadCount > 0 && styles.rowUnread]}
        onPress={() => router.push(`/(app)/chat/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${otherUser.firstName} ${otherUser.lastName}${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        {otherUser.profilePhotoUrl ? (
          <Image source={{ uri: otherUser.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.middle}>
          <Text style={[styles.name, unreadCount > 0 && styles.nameBold]} numberOfLines={1}>
            {otherUser.firstName} {otherUser.lastName}
          </Text>
          {lastMessage && (
            <Text style={[styles.preview, unreadCount > 0 && styles.previewBold]} numberOfLines={1}>
              {lastMessage.content}
            </Text>
          )}
        </View>
        <View style={styles.right}>
          {lastMessage && (
            <Text style={styles.time}>{formatTime(lastMessage.createdAt)}</Text>
          )}
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.orange} size="large" />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <MessageSquarePlus color={colors.textMuted} size={48} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyBody}>
            Start a conversation from someone's profile or your connections list.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          onRefresh={onRefresh}
          refreshing={refreshing}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  loader: { flex: 1, justifyContent: 'center' },
  list: { paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 12,
  },
  rowUnread: { backgroundColor: colors.surface },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  middle: { flex: 1 },
  name: { ...typography.body, color: colors.text },
  nameBold: { fontWeight: '700' },
  preview: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  previewBold: { color: colors.text, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 4 },
  time: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  badge: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textInverse, fontSize: 11, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
