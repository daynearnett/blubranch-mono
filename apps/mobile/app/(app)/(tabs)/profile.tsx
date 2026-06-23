import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronRight, Pencil, Shield } from 'lucide-react-native';
import { Badge, Button, Card } from '../../../src/components/ui.js';
import { ProfileHeader } from '../../../src/components/profile-header.js';
import { VerifiedBadge } from '../../../src/components/verified-badge.js';
import { SectionDivider } from '../../../src/components/section-divider.js';
import { ProgressBar } from '../../../src/components/progress-bar.js';
import * as ImagePicker from 'expo-image-picker';
import { ApiError, me, uploadImage, type MeResponse } from '../../../src/lib/api.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

type Tab = 'about' | 'portfolio' | 'posts';

export default function Profile() {
  const router = useRouter();
  const { signOut, user, setUser } = useAuth();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('about');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    me.get()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load profile'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChangePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const url = await uploadImage(result.assets[0].uri);
      await me.updatePhoto(url);
      if (user) setUser({ ...user, profilePhotoUrl: url });
      load();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    me.get()
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button label="Sign out" variant="outline" onPress={signOut} />
      </SafeAreaView>
    );
  }
  if (!data) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.orange} />
      </SafeAreaView>
    );
  }

  const stats = { connections: 0, posts: 0, rating: 0, endorsements: 0 };
  const completeness = computeCompleteness(data);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} />}
      >
        <ProfileHeader
          profile={data}
          stats={stats}
          active={tab}
          onTabChange={setTab}
          isMe
          onSettings={() => router.push('/(app)/settings')}
          onAvatarPress={onChangePhoto}
        />

        {completeness < 100 ? (
          <View style={styles.completenessCard}>
            <View style={styles.completenessHeader}>
              <Text style={styles.completenessTitle}>Profile strength</Text>
              <Text style={styles.completenessPercent}>{completeness}%</Text>
            </View>
            <ProgressBar progress={completeness} />
            <Text style={styles.completenessHint}>
              Complete your profile to appear in more searches
            </Text>
          </View>
        ) : null}

        <View style={styles.content}>
          {tab === 'about' ? (
            <AboutTab
              data={data}
              onVerify={() => router.push('/(app)/verifications')}
              onAddPhoto={onChangePhoto}
            />
          ) : null}
          {tab === 'portfolio' ? <PortfolioTab data={data} /> : null}
          {tab === 'posts' ? <PostsTab /> : null}
        </View>

        <SectionDivider />
      </ScrollView>
    </SafeAreaView>
  );
}

function computeCompleteness(data: MeResponse): number {
  let score = 0;
  if (data.profilePhotoUrl) score += 25;
  if (data.skills.length > 0) score += 20;
  if (data.workerProfile?.bio) score += 15;
  if (data.certifications.length > 0 || (data.licenses?.length ?? 0) > 0) score += 15;
  if (data.workHistory.length > 0 || (data.workPlaces?.length ?? 0) > 0) score += 10;
  if (data.portfolioPhotos.length > 0) score += 15;
  return Math.min(100, score);
}

// ── S9/S10: Enrichment cards ────────────────────────────────────
function EnrichmentCards({
  data,
  onVerify,
  onAddPhoto,
}: {
  data: MeResponse;
  onVerify?: () => void;
  onAddPhoto?: () => void;
}) {
  const cards: { key: string; title: string; subtitle: string; icon: typeof Camera; onPress?: () => void }[] = [];

  if (!data.profilePhotoUrl) {
    cards.push({
      key: 'photo',
      title: 'Add a profile photo',
      subtitle: 'Profiles with photos get 5x more views',
      icon: Camera,
      onPress: onAddPhoto,
    });
  }
  if (data.skills.length === 0) {
    cards.push({
      key: 'skills',
      title: 'Add your skills',
      subtitle: 'Help employers find you by your expertise',
      icon: Shield,
      onPress: () =>
        Alert.alert(
          'Add your skills',
          "We're building the skills picker — coming in an upcoming update.",
        ),
    });
  }
  if ((data.licenses?.length ?? 0) === 0 && data.certifications.length === 0) {
    cards.push({
      key: 'license',
      title: 'Verify a license',
      subtitle: 'Stand out with a verified badge',
      icon: Shield,
      onPress: onVerify,
    });
  }

  if (cards.length === 0) return null;

  return (
    <View style={enrichStyles.container}>
      <Text style={enrichStyles.sectionTitle}>Enhance your profile</Text>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Pressable key={card.key} style={enrichStyles.card} onPress={card.onPress}>
            <View style={enrichStyles.iconCircle}>
              <Icon color={colors.orange} size={18} strokeWidth={2} />
            </View>
            <View style={enrichStyles.cardText}>
              <Text style={enrichStyles.cardTitle}>{card.title}</Text>
              <Text style={enrichStyles.cardSubtitle}>{card.subtitle}</Text>
            </View>
            <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}

const enrichStyles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.navy, marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { ...typography.bodyBold, color: colors.navy },
  cardSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
});

// ── S12: About tab ──────────────────────────────────────────────
function AboutTab({
  data,
  onVerify,
  onAddPhoto,
}: {
  data: MeResponse;
  onVerify?: () => void;
  onAddPhoto?: () => void;
}) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const bio = data.workerProfile?.bio ?? '';
  const showSeeMore = bio.length > 150;

  return (
    <View>
      <EnrichmentCards data={data} onVerify={onVerify} onAddPhoto={onAddPhoto} />

      {bio ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <Text style={[typography.body, { color: colors.textBody }]} numberOfLines={bioExpanded ? undefined : 4}>
            {bio}
          </Text>
          {showSeeMore && !bioExpanded ? (
            <Pressable onPress={() => setBioExpanded(true)}>
              <Text style={styles.seeMore}>see more</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* Licenses section */}
      {(data.licenses?.length ?? 0) > 0 ? (
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Licenses</Text>
          </View>
          {data.licenses.map((lic) => (
            <View key={lic.id} style={styles.licenseRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{lic.type}</Text>
                <Text style={styles.muted}>#{lic.number} · {lic.issuingState}</Text>
              </View>
              {lic.status === 'verified' ? <VerifiedBadge size="mini" /> : (
                <Badge label={lic.status} tone="neutral" />
              )}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Skills</Text>
        </View>
        <View style={styles.chipRow}>
          {data.skills.length === 0 ? (
            <Text style={styles.empty}>No skills selected yet</Text>
          ) : (
            data.skills.map((s) => <Badge key={s.id} label={s.name} style={styles.chipBadge} />)
          )}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Certifications</Text>
        </View>
        {data.certifications.length === 0 ? (
          <Text style={styles.empty}>No certifications added yet</Text>
        ) : (
          data.certifications.map((c) => (
            <View key={c.id} style={styles.certRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{c.name}</Text>
                {c.certificationNumber ? (
                  <Text style={styles.muted}>#{c.certificationNumber}</Text>
                ) : null}
              </View>
              {c.isVerified ? <VerifiedBadge size="mini" /> : null}
            </View>
          ))
        )}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Experience</Text>
        </View>
        {data.workHistory.length === 0 ? (
          <Text style={styles.empty}>No work history yet</Text>
        ) : (
          data.workHistory.map((w) => (
            <View key={w.id} style={styles.workRow}>
              <Text style={typography.bodyBold}>{w.companyName}</Text>
              <Text style={[typography.body, { color: colors.textBody }]}>{w.title}</Text>
              <Text style={styles.muted}>
                {new Date(w.startDate).getFullYear()} –{' '}
                {w.isCurrent ? 'Present' : new Date(w.endDate ?? '').getFullYear()}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

// ── S13: Portfolio tab ──────────────────────────────────────────
function PortfolioTab({ data }: { data: MeResponse }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Portfolio</Text>
      {data.portfolioPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Camera color={colors.textMuted} size={32} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptyBody}>
            Show off your best work to attract employers and build credibility.
          </Text>
        </View>
      ) : (
        <View style={styles.photoGrid}>
          {data.portfolioPhotos.map((p) => (
            <View key={p.id} style={styles.photoTile}>
              <Image source={{ uri: p.photoUrl }} style={styles.photoImage} />
              {p.caption ? <Text style={styles.photoCaption}>{p.caption}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.endorsementsSection}>
        <Text style={styles.sectionTitle}>Endorsements</Text>
        <Text style={styles.empty}>No endorsements yet — connect with peers to receive them.</Text>
      </View>
    </View>
  );
}

// ── S14: Posts tab ──────────────────────────────────────────────
function PostsTab() {
  return (
    <View style={styles.emptyState}>
      <Pencil color={colors.textMuted} size={32} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptyBody}>
        Share photos of your work and updates to start building your network.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
  content: { padding: spacing.lg },
  completenessCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  completenessTitle: { ...typography.bodyBold, color: colors.navy },
  completenessPercent: { ...typography.bodyBold, color: colors.orange },
  completenessHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.navy },
  seeMore: { ...typography.bodyBold, color: colors.orange, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  chipBadge: { marginRight: spacing.xs, marginBottom: spacing.xs },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  workRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  muted: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  empty: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: { ...typography.h3, color: colors.navy, marginTop: spacing.md },
  emptyBody: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  photoTile: { width: '31.5%' },
  photoImage: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
  photoCaption: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  endorsementsSection: { marginTop: spacing.xl },
});
