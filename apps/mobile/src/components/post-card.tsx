// Social feed post card (Mockup screen 4 — first item).
import { useState } from 'react';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react-native';
import { Badge } from './ui.js';
import { VerifiedBadge } from './verified-badge.js';
import { useAuth } from '../lib/auth-context.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { PhotoCarousel } from './photo-carousel.js';
import { apiBaseUrl, posts as postsApi, reports as reportsApi, type FeedPost } from '../lib/api.js';
import type { ReportReason } from '@blubranch/shared';

export function PostCard({
  post: initial,
  onMutated,
}: {
  post: FeedPost;
  onMutated?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isOwner = user?.id === post.user.id;

  const onMore = () => {
    Alert.alert('Post options', undefined, [
      {
        text: 'Archive',
        onPress: async () => {
          setHidden(true);
          try {
            await postsApi.archive(post.id);
            onMutated?.();
          } catch {
            setHidden(false);
          }
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete post?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                setHidden(true);
                try {
                  await postsApi.remove(post.id);
                  onMutated?.();
                } catch {
                  setHidden(false);
                }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Non-owners can report a post. Pick a reason, then submit; on success we
  // hide it locally so the reporter stops seeing it.
  const onReport = () => {
    const reasons: { label: string; value: ReportReason }[] = [
      { label: 'Nudity or sexual content', value: 'explicit' },
      { label: 'Harassment or bullying', value: 'harassment' },
      { label: 'Hate speech', value: 'hate' },
      { label: 'Spam', value: 'spam' },
      { label: 'Something else', value: 'other' },
    ];
    Alert.alert('Report post', 'Why are you reporting this post?', [
      ...reasons.map((r) => ({
        text: r.label,
        onPress: async () => {
          try {
            await reportsApi.create({ targetType: 'post', targetId: post.id, reason: r.value });
            setHidden(true);
            Alert.alert('Thanks for the report', "Our team will review this post. You won't see it again.");
          } catch {
            Alert.alert('Could not submit', 'Please try again.');
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  if (hidden) return null;
  const initials = `${post.user.firstName[0] ?? ''}${post.user.lastName[0] ?? ''}`.toUpperCase();
  const elapsed = relativeTime(new Date(post.createdAt));
  const showSeeMore = post.content.length > 280 && !expanded;

  const onShare = async () => {
    const excerpt =
      post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content;
    // https link → OpenGraph preview page (logo + author + excerpt) that
    // deep-links into the app, so iMessage shows a rich card not a bare link.
    const url = `${apiBaseUrl()}/share/post/${post.id}`;
    try {
      await Share.share({
        message: `${post.user.firstName} ${post.user.lastName} on BluBranch:\n\n"${excerpt}"`,
        url,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const onLikePress = async () => {
    if (busy) return;
    setBusy(true);
    const next = !post.likedByMe;
    setPost((p) => ({
      ...p,
      likedByMe: next,
      likeCount: p.likeCount + (next ? 1 : -1),
    }));
    try {
      if (next) await postsApi.like(post.id);
      else await postsApi.unlike(post.id);
    } catch {
      // rollback
      setPost(initial);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.authorTap}
          onPress={() => router.push(`/(app)/users/${post.user.id}`)}
        >
          {post.user.profilePhotoUrl ? (
            <Image source={{ uri: post.user.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {post.user.firstName} {post.user.lastName}
              </Text>
              {post.user.unionName ? <Badge label={post.user.unionName} tone="primary" /> : null}
            </View>
            {post.user.headline ? (
              <Text style={styles.headline} numberOfLines={1}>
                {post.user.headline}
              </Text>
            ) : null}
            <Text style={styles.elapsed}>{elapsed}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={isOwner ? onMore : onReport}
          hitSlop={8}
          style={styles.moreBtn}
          accessibilityLabel={isOwner ? 'Post options' : 'Report post'}
        >
          <MoreHorizontal color={colors.textMuted} size={20} strokeWidth={2} />
        </Pressable>
      </View>

      <Text style={styles.content} numberOfLines={expanded ? undefined : 4}>
        {post.content}
      </Text>
      {showSeeMore ? (
        <Pressable onPress={() => setExpanded(true)}>
          <Text style={styles.seeMore}>see more</Text>
        </Pressable>
      ) : null}

      {post.photos.length > 0 ? <PhotoCarousel photos={post.photos} /> : null}

      <View style={styles.engagementRow}>
        <Pressable onPress={onLikePress} style={styles.engagementBtn} disabled={busy}>
          <Heart
            color={post.likedByMe ? colors.orange : colors.textMuted}
            size={18}
            strokeWidth={post.likedByMe ? 2.5 : 1.8}
            fill={post.likedByMe ? colors.orange : 'none'}
          />
          <Text style={[styles.engagementLabel, post.likedByMe && styles.engagementLabelActive]}>
            {post.likeCount}
          </Text>
        </Pressable>
        <Pressable
          style={styles.engagementBtn}
          onPress={() => router.push(`/(app)/post/${post.id}`)}
        >
          <MessageCircle color={colors.textMuted} size={18} strokeWidth={1.8} />
          <Text style={styles.engagementLabel}>{post.commentCount}</Text>
        </Pressable>
        <Pressable style={styles.engagementBtn} onPress={onShare}>
          <Share2 color={colors.textMuted} size={18} strokeWidth={1.8} />
          <Text style={styles.engagementLabel}>Share</Text>
        </Pressable>
      </View>

      {post.topComments && post.topComments.length > 0 ? (
        <View style={styles.comments}>
          {post.commentCount > post.topComments.length ? (
            <Pressable onPress={() => router.push(`/(app)/post/${post.id}`)}>
              <Text style={styles.viewAll}>View all {post.commentCount} comments</Text>
            </Pressable>
          ) : null}
          {post.topComments.map((c) => (
            <Text key={c.id} style={styles.commentText} numberOfLines={2}>
              <Text style={styles.commentName}>
                {c.user.firstName} {c.user.lastName}{' '}
              </Text>
              {c.content}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  authorTap: { flexDirection: 'row', gap: spacing.sm, flex: 1, alignItems: 'center' },
  moreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { ...typography.bodyBold, color: colors.primaryDark },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  headline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  elapsed: { ...typography.caption, color: colors.textSecondary },
  content: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: 22 },
  seeMore: { ...typography.bodyBold, color: colors.navy, marginBottom: spacing.sm },
  engagementRow: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  engagementBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  engagementLabel: { ...typography.small, color: colors.textMuted },
  engagementLabelActive: { color: colors.navy },
  comments: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  viewAll: { ...typography.small, color: colors.textMuted, marginBottom: spacing.xs },
  commentText: { ...typography.small, color: colors.textPrimary, lineHeight: 18 },
  commentName: { fontWeight: '700', color: colors.navy },
});
