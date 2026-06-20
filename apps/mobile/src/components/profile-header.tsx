import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, MapPin, Pencil, Settings } from 'lucide-react-native';
import type { MeResponse, PublicProfile } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';
import { Badge } from './ui.js';
import { VerifiedBadge } from './verified-badge.js';
import { ConnectButton } from './connect-button.js';

type ProfileLike = MeResponse | PublicProfile;

interface Props {
  profile: ProfileLike;
  stats?: { connections: number; posts: number; rating: number; endorsements: number };
  active: 'about' | 'portfolio' | 'posts';
  onTabChange: (tab: 'about' | 'portfolio' | 'posts') => void;
  isMe?: boolean;
  onSettings?: () => void;
  onEditProfile?: () => void;
  onAvatarPress?: () => void;
}

export function ProfileHeader({ profile, stats, active, onTabChange, isMe, onSettings, onEditProfile, onAvatarPress }: Props) {
  const wp = profile.workerProfile;
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase();

  const autoHeadline = buildAutoHeadline(wp);
  const headline = wp?.headline || autoHeadline || 'Tradesperson';
  const location = wp?.city && wp?.state ? `${wp.city}, ${wp.state}` : null;

  return (
    <View>
      <View style={styles.header}>
        {isMe && onSettings ? (
          <Pressable style={styles.settingsBtn} onPress={onSettings} accessibilityLabel="Settings">
            <Settings color="rgba(255,255,255,0.7)" size={20} strokeWidth={2} />
          </Pressable>
        ) : null}

        <Pressable
          style={styles.avatarWrap}
          onPress={isMe ? onAvatarPress : undefined}
          disabled={!isMe || !onAvatarPress}
          accessibilityLabel={isMe ? 'Change profile photo' : undefined}
        >
          {profile.profilePhotoUrl ? (
            <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {isMe ? (
            <View style={styles.avatarCamera}>
              <Camera color={colors.textInverse} size={15} strokeWidth={2} />
            </View>
          ) : null}
          {profile.isVerified ? (
            <View style={styles.verifiedPos}>
              <VerifiedBadge size="small" />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{fullName}</Text>
          {profile.isVerified ? <VerifiedBadge size="mini" /> : null}
        </View>
        <Text style={styles.headline}>{headline}</Text>
        {location ? (
          <View style={styles.locationRow}>
            <MapPin color="rgba(255,255,255,0.6)" size={14} strokeWidth={2} />
            <Text style={styles.location}>{location}</Text>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          {wp?.unionName ? <Badge label={wp.unionName} tone="primary" /> : null}
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

        {isMe && onEditProfile ? (
          <Pressable style={styles.editBtn} onPress={onEditProfile}>
            <Pencil color={colors.textInverse} size={14} strokeWidth={2} />
            <Text style={styles.editBtnLabel}>Edit profile</Text>
          </Pressable>
        ) : null}

        {!isMe ? (
          <View style={styles.actionRow}>
            <ConnectButton />
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

function buildAutoHeadline(wp: ProfileLike['workerProfile']): string | null {
  if (!wp) return null;
  const parts: string[] = [];
  if ('currentTitle' in wp && typeof wp.currentTitle === 'string') parts.push(wp.currentTitle);
  if ('tradeYears' in wp && typeof wp.tradeYears === 'number') parts.push(`${wp.tradeYears} yrs`);
  if (wp.unionName) parts.push(wp.unionName);
  return parts.length > 0 ? parts.join(' · ') : null;
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
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  settingsBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { marginBottom: spacing.md },
  avatarCamera: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.navy,
  },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28, fontWeight: '700', color: colors.navy },
  verifiedPos: {
    position: 'absolute',
    right: 2,
    bottom: 2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xxs },
  name: { ...typography.h2, color: colors.textInverse },
  headline: { ...typography.body, color: 'rgba(255,255,255,0.85)', marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  location: { ...typography.small, color: 'rgba(255,255,255,0.6)' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: spacing.md, gap: spacing.xs },
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
  statLabel: { ...typography.small, color: 'rgba(255,255,255,0.6)' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: spacing.md,
  },
  editBtnLabel: { ...typography.bodyBold, color: colors.textInverse },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tabLabel: { ...typography.bodyBold, color: colors.textMuted },
  tabLabelActive: { color: colors.navy },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    backgroundColor: colors.orange,
  },
});
