// Today's Headlines — the top blue-collar industry story of the day, at the
// top of the feed (replaces the Toolbox Talk slot). One story, news-site
// feel without the clutter: image, headline, source + time, tap to read.
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Newspaper } from 'lucide-react-native';
import { headlines, type Headline } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

export function TodaysHeadlineCard() {
  const [headline, setHeadline] = useState<Headline | null>(null);

  useEffect(() => {
    headlines
      .today()
      .then((res) => setHeadline(res.headline))
      .catch(() => {});
  }, []);

  if (!headline) return null;

  const open = () => {
    Linking.openURL(headline.url).catch(() => {});
  };

  return (
    <Pressable style={styles.card} onPress={open} accessibilityRole="link">
      <View style={styles.header}>
        <Newspaper color={colors.navy} size={18} strokeWidth={2} />
        <Text style={styles.headerLabel}>Today's Headlines</Text>
      </View>
      {headline.imageUrl ? (
        <Image source={{ uri: headline.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : null}
      <Text style={styles.title} numberOfLines={3}>
        {headline.title}
      </Text>
      {headline.summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {headline.summary}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.source}>{headline.source}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{relativeTime(new Date(headline.publishedAt))}</Text>
        <Text style={styles.readMore}>Read the story →</Text>
      </View>
    </Pressable>
  );
}

function relativeTime(d: Date): string {
  const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  headerLabel: { ...typography.bodyBold, color: colors.navy },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary, lineHeight: 24 },
  summary: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  source: { ...typography.caption, color: colors.navy, fontWeight: '600' },
  dot: { ...typography.caption, color: colors.textMuted },
  time: { ...typography.caption, color: colors.textMuted },
  readMore: { ...typography.caption, color: colors.steel, fontWeight: '600', marginLeft: 'auto' },
});
