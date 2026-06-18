// Social feed post card (Mockup screen 4 — first item).
import { useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { Badge } from './ui.js';
import { VerifiedBadge } from './verified-badge.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { posts as postsApi, type FeedPost } from '../lib/api.js';

export function PostCard({ post: initial }: { post: FeedPost }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const initials = `${post.user.firstName[0] ?? ''}${post.user.lastName[0] ?? ''}`.toUpperCase();
  const elapsed = relativeTime(new Date(post.createdAt));
  const showSeeMore = post.content.length > 280 && !expanded;

  const onShare = async () => {
    const excerpt =
      post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content;
    try {
      await Share.share({
        message: `${post.user.firstName} ${post.user.lastName} on BluBranch:\n\n"${excerpt}"\n\nblubranch://post/${post.id}`,
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
      </View>

      <Text style={styles.content} numberOfLines={expanded ? undefined : 4}>
        {post.content}
      </Text>
      {showSeeMore ? (
        <Pressable onPress={() => setExpanded(true)}>
          <Text style={styles.seeMore}>see more</Text>
        </Pressable>
      ) : null}

      {post.photos.length > 0 ? (
        <Image source={{ uri: post.photos[0]!.photoUrl }} style={styles.heroPhoto} />
      ) : null}

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
  seeMore: { ...typography.bodyBold, color: colors.orange, marginBottom: spacing.sm },
  heroPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  engagementRow: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  engagementBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  engagementLabel: { ...typography.small, color: colors.textMuted },
  engagementLabelActive: { color: colors.orange },
});
