import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MeResponse, PublicProfile } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { Badge } from './ui.js';

type ProfileLike = MeResponse | PublicProfile;

interface Props {
  profile: ProfileLike;
  stats?: { connections: number; posts: number; rating: number; endorsements: number };
  active: 'about' | 'portfolio' | 'posts';
  onTabChange: (tab: 'about' | 'portfolio' | 'posts') => void;
  isMe?: boolean;
}

export function ProfileHeader({ profile, stats, active, onTabChange, isMe }: Props) {
  const wp = profile.workerProfile;
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase();
  const headline = wp?.headline ?? 'Tradesperson';
  const location = wp?.city && wp?.state ? `${wp.city}, ${wp.state}` : null;
  const radiusLine = wp?.travelRadiusMiles ? ` · Within ${wp.travelRadiusMiles} miles` : '';

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {profile.profilePhotoUrl ? (
            <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.headline}>{headline}</Text>
        {location ? (
          <Text style={styles.location}>
            {location}
            {radiusLine}
          </Text>
        ) : null}

        <View style={styles.badgeRow}>
          {wp?.unionName ? <Badge label={wp.unionName} tone="primary" /> : null}
          {profile.isVerified ? <Badge label="✓ Verified" tone="success" /> : null}
          {wp?.jobAvailability === 'open' || wp?.jobAvailability === 'actively_looking' ? (
            <Badge label="Open to Work" tone="success" />
          ) : null}
        </View>

        {stats ? (
          <View style={styles.statsRow}>
            <Stat value={stats.connections} label="Connections" />
            <Stat value={stats.posts} label="Posts" />
            <Stat
              value={stats.rating > 0 ? stats.rating.toFixed(1) : '—'}
              label="Rating"
            />
            <Stat value={stats.endorsements} label="Endorsements" />
          </View>
        ) : null}

        {!isMe ? (
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, styles.actionPrimary]}>
              <Text style={styles.actionPrimaryLabel}>Connect</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionOutline]}>
              <Text style={styles.actionOutlineLabel}>Message</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        {(['about', 'portfolio', 'posts'] as const).map((tab) => (
          <Pressable key={tab} style={styles.tab} onPress={() => onTabChange(tab)}>
            <Text style={[styles.tabLabel, active === tab && styles.tabLabelActive]}>
              {tab[0]?.toUpperCase() + tab.slice(1)}
            </Text>
            {active === tab ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  avatarWrap: { marginBottom: spacing.md },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { ...typography.h1, color: colors.primaryDark },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    backgroundColor: colors.success,
  },
  name: { ...typography.h2, color: colors.textInverse, marginBottom: spacing.xs },
  headline: { ...typography.body, color: colors.textInverse, marginBottom: spacing.xs },
  location: { ...typography.small, color: '#cbd5e1', marginBottom: spacing.md },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: spacing.md },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    marginTop: spacing.sm,
  },
  statCol: { alignItems: 'center', flex: 1 },
  statValue: { ...typography.h3, color: colors.textInverse },
  statLabel: { ...typography.caption, color: '#cbd5e1' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryLabel: { ...typography.bodyBold, color: colors.textInverse },
  actionOutline: { borderWidth: 1, borderColor: colors.textInverse },
  actionOutlineLabel: { ...typography.bodyBold, color: colors.textInverse },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabLabel: { ...typography.bodyBold, color: colors.textSecondary },
  tabLabelActive: { color: colors.primary },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    backgroundColor: colors.primary,
  },
});
