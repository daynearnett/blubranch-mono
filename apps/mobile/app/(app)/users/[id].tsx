// Public profile (mockup screens 5A / 5B / 5C) for any user id.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card } from '../../../src/components/ui.js';
import { ProfileHeader } from '../../../src/components/profile-header.js';
import { ApiError, users, type PublicProfile } from '../../../src/lib/api.js';
import { colors, spacing, typography } from '../../../src/theme.js';

type Tab = 'about' | 'portfolio' | 'posts';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('about');

  useEffect(() => {
    if (!id) return;
    users
      .get(id)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Not found'));
  }, [id]);

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error}</Text>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView>
        <ProfileHeader profile={data} stats={data.stats} active={tab} onTabChange={setTab} />
        <View style={styles.content}>
          {tab === 'about' ? (
            <View>
              {data.workerProfile?.bio ? (
                <Card>
                  <Text style={typography.h3}>About</Text>
                  <Text style={[typography.body, { marginTop: spacing.sm }]}>
                    {data.workerProfile.bio}
                  </Text>
                </Card>
              ) : null}
              <Card>
                <Text style={typography.h3}>Skills</Text>
                <View style={styles.chipRow}>
                  {data.skills.map((s) => (
                    <Badge key={s.id} label={s.name} style={{ marginRight: 4, marginBottom: 4 }} />
                  ))}
                </View>
              </Card>
              <Card>
                <Text style={typography.h3}>Certifications</Text>
                {data.certifications.map((c) => (
                  <View key={c.id} style={styles.certRow}>
                    <Text style={typography.bodyBold}>{c.name}</Text>
                    {c.isVerified ? <Badge label="Verified" tone="success" /> : null}
                  </View>
                ))}
              </Card>
              <Card>
                <Text style={typography.h3}>Work history</Text>
                {data.workHistory.map((w) => (
                  <View key={w.id} style={styles.workRow}>
                    <Text style={typography.bodyBold}>{w.companyName}</Text>
                    <Text style={typography.body}>{w.title}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {tab === 'portfolio' ? (
            <View>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Portfolio</Text>
              <View style={styles.photoGrid}>
                {data.portfolioPhotos.map((p) => (
                  <View key={p.id} style={styles.photoTile}>
                    <Image source={{ uri: p.photoUrl }} style={styles.photoImage} />
                    {p.caption ? <Text style={styles.photoCaption}>{p.caption}</Text> : null}
                  </View>
                ))}
              </View>

              <Text style={[typography.h3, { marginTop: spacing.lg }]}>Endorsements</Text>
              {data.endorsements.map((e) => (
                <Card key={e.id}>
                  <Text style={typography.bodyBold}>{e.endorserTitle}</Text>
                  <Text style={[typography.body, { marginTop: spacing.xs }]}>{e.content}</Text>
                </Card>
              ))}
            </View>
          ) : null}

          {tab === 'posts' ? (
            <Text style={typography.body}>Posts feed lands in Phase 4.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.body, color: colors.danger },
  content: { padding: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  workRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: '48%' },
  photoImage: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  photoCaption: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
});
