// Mockup screens 5A / 5B / 5C — Worker profile (About / Portfolio / Posts)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '../../../src/components/ui.js';
import { ProfileHeader } from '../../../src/components/profile-header.js';
import { ApiError, me, type MeResponse } from '../../../src/lib/api.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { colors, spacing, typography } from '../../../src/theme.js';

type Tab = 'about' | 'portfolio' | 'posts';

export default function Profile() {
  const { signOut } = useAuth();
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('about');

  useEffect(() => {
    me.get()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load profile'));
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
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Stats: connections/posts/endorsements come from public-profile shape;
  // for /users/me we don't expose them yet. Render placeholders for now.
  const stats = { connections: 0, posts: 0, rating: 0, endorsements: 0 };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView stickyHeaderIndices={[]}>
        <ProfileHeader profile={data} stats={stats} active={tab} onTabChange={setTab} isMe />
        <View style={styles.content}>
          {tab === 'about' ? <AboutTab data={data} /> : null}
          {tab === 'portfolio' ? <PortfolioTab data={data} /> : null}
          {tab === 'posts' ? <PostsTab /> : null}
        </View>

        <View style={styles.signOutRow}>
          <Button variant="ghost" label="Sign out" onPress={signOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 5A About tab ──────────────────────────────────────────────────
function AboutTab({ data }: { data: MeResponse }) {
  return (
    <View>
      {data.workerProfile?.bio ? (
        <Card>
          <Text style={typography.h3}>About</Text>
          <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {data.workerProfile.bio}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={typography.h3}>Skills</Text>
        <View style={styles.chipRow}>
          {data.skills.length === 0 ? (
            <Text style={styles.empty}>No skills selected yet</Text>
          ) : (
            data.skills.map((s) => <Badge key={s.id} label={s.name} style={styles.chipBadge} />)
          )}
        </View>
      </Card>

      <Card>
        <Text style={typography.h3}>Licenses & certifications</Text>
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
              {c.isVerified ? <Badge label="Verified" tone="success" /> : null}
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={typography.h3}>Work history</Text>
        {data.workHistory.length === 0 ? (
          <Text style={styles.empty}>No work history yet</Text>
        ) : (
          data.workHistory.map((w) => (
            <View key={w.id} style={styles.workRow}>
              <Text style={typography.bodyBold}>{w.companyName}</Text>
              <Text style={typography.body}>{w.title}</Text>
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

// ── 5B Portfolio tab ──────────────────────────────────────────────
function PortfolioTab({ data }: { data: MeResponse }) {
  return (
    <View>
      <Text style={[typography.h3, { marginBottom: spacing.md }]}>Portfolio</Text>
      <View style={styles.photoGrid}>
        {data.portfolioPhotos.length === 0 ? (
          <Text style={styles.empty}>No photos yet</Text>
        ) : (
          data.portfolioPhotos.map((p) => (
            <View key={p.id} style={styles.photoTile}>
              <Image source={{ uri: p.photoUrl }} style={styles.photoImage} />
              {p.caption ? <Text style={styles.photoCaption}>{p.caption}</Text> : null}
            </View>
          ))
        )}
      </View>

      <Text style={[typography.h3, { marginTop: spacing.lg }]}>Endorsements</Text>
      <Text style={styles.empty}>No endorsements yet — connect with peers to receive them.</Text>
    </View>
  );
}

// ── 5C Posts tab ──────────────────────────────────────────────────
function PostsTab() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <Text style={typography.h3}>No posts yet</Text>
      <Text style={[styles.empty, { marginTop: spacing.sm, textAlign: 'center' }]}>
        Share photos of your work to start building your network.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.danger, marginBottom: spacing.md },
  content: { padding: spacing.lg },
  signOutRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chipBadge: { marginRight: spacing.xs, marginBottom: spacing.xs },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  workRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  muted: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: '48%' },
  photoImage: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  photoCaption: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
});
