// Post comments screen — opened from a post card's comment button and the
// blubranch://post/<id> deep link (Share). Shows the post being commented on
// as a preview header so the deep link lands on something meaningful.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, AtSign, Send, X } from 'lucide-react-native';
import { posts as postsApi, type FeedPost } from '../../../src/lib/api.js';
import { Badge } from '../../../src/components/ui.js';
import { MentionTextInput, type Mention } from '../../../src/components/mention-text-input.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

type Comment = Awaited<ReturnType<typeof postsApi.comments>>[number];

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({
  url,
  first,
  last,
  size,
}: {
  url: string | null;
  first: string;
  last: string;
  size: number;
}) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.avatarInitials}>
        {`${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()}
      </Text>
    </View>
  );
}

function PostPreview({ post }: { post: FeedPost }) {
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <Avatar url={post.user.profilePhotoUrl} first={post.user.firstName} last={post.user.lastName} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.previewName}>
              {post.user.firstName} {post.user.lastName}
            </Text>
            {post.user.unionName ? <Badge label={post.user.unionName} tone="primary" /> : null}
          </View>
          {post.user.headline ? (
            <Text style={styles.previewHeadline} numberOfLines={1}>
              {post.user.headline}
            </Text>
          ) : null}
          <Text style={styles.previewTime}>{relativeTime(post.createdAt)}</Text>
        </View>
      </View>
      <Text style={styles.previewContent}>{post.content}</Text>
      {post.photos.length > 0 ? (
        <Image source={{ uri: post.photos[0]!.photoUrl }} style={styles.previewPhoto} />
      ) : null}
      <View style={styles.previewStats}>
        <Text style={styles.previewStat}>{post.likeCount} likes</Text>
        <Text style={styles.previewStat}>{post.commentCount} comments</Text>
      </View>
    </View>
  );
}

export default function PostComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tagged, setTagged] = useState<Mention[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, c] = await Promise.allSettled([postsApi.get(id), postsApi.comments(id)]);
    if (p.status === 'fulfilled') setPost(p.value);
    if (c.status === 'fulfilled') setComments(c.value);
  }, [id]);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const send = async () => {
    const content = text.trim();
    if (!content || !id || sending) return;
    setSending(true);
    try {
      await postsApi.comment(id, {
        content,
        mentionedUserIds: tagged.length ? tagged.map((t) => t.id) : undefined,
      });
      setText('');
      setTagged([]);
      // Refetch the real post (authoritative comment count) + the comment list
      // so the count and thread always reflect what's saved — no manual refresh.
      const [c, p] = await Promise.all([postsApi.comments(id), postsApi.get(id)]);
      setComments(c);
      setPost(p);
    } catch {
      Alert.alert('Could not post comment', 'Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Comments</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={8}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.orange} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={post ? <PostPreview post={post} /> : null}
            ListEmptyComponent={
              <Text style={styles.empty}>No comments yet. Be the first.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Avatar
                  url={item.user.profilePhotoUrl}
                  first={item.user.firstName}
                  last={item.user.lastName}
                  size={36}
                />
                <View style={styles.bubble}>
                  <Text style={styles.commentName}>
                    {item.user.firstName} {item.user.lastName}
                  </Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
              </View>
            )}
          />
        )}

        {tagged.length > 0 ? (
          <View style={styles.tagChips}>
            {tagged.map((t) => (
              <Pressable
                key={t.id}
                style={styles.tagChip}
                onPress={() => setTagged((prev) => prev.filter((p) => p.id !== t.id))}
              >
                <AtSign color={colors.orange} size={11} strokeWidth={2} />
                <Text style={styles.tagChipText}>{t.name}</Text>
                <X color={colors.textMuted} size={9} strokeWidth={2} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.composer}>
          <MentionTextInput
            containerStyle={styles.composerInput}
            inputStyle={styles.input}
            placeholder="Add a comment… tag with @"
            value={text}
            onChangeText={setText}
            multiline
            mentions={tagged}
            onMentionsChange={setTagged}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          >
            <Send color={colors.textInverse} size={18} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  list: { paddingBottom: spacing.lg, flexGrow: 1 },
  // Post preview header
  preview: {
    padding: spacing.lg,
    borderBottomWidth: 8,
    borderBottomColor: colors.surface,
  },
  previewHeader: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  previewName: { ...typography.bodyBold, color: colors.textPrimary },
  previewHeadline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  previewTime: { ...typography.caption, color: colors.textSecondary },
  previewContent: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  previewPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  previewStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewStat: { ...typography.small, color: colors.textMuted },
  // Comments
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  commentRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  avatarFallback: { backgroundColor: colors.chipBg, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { ...typography.small, fontWeight: '700', color: colors.primaryDark },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  commentName: { ...typography.small, fontWeight: '700', color: colors.navy, marginBottom: 2 },
  commentText: { ...typography.body, color: colors.textPrimary },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBgActive,
  },
  tagChipText: { ...typography.caption, color: colors.navy, fontWeight: '600' },
  tagBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
