// Mockup screen 3C — Profile creation step 3 of 4: Work photos & history
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input, ProgressDots } from '../../src/components/ui.js';
import { ApiError, me, uploadImage, type MeResponse } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function ProfileCreatePhotos() {
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [startYear, setStartYear] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [endYear, setEndYear] = useState('');

  useEffect(() => {
    me.get()
      .then(setData)
      .catch((err) =>
        Alert.alert('Could not load profile', err instanceof ApiError ? err.message : 'Try again'),
      );
  }, []);

  const refresh = async () => setData(await me.get());

  const addPhoto = async () => {
    if ((data?.portfolioPhotos.length ?? 0) >= 12) {
      Alert.alert('Max reached', 'You can upload up to 12 portfolio photos.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      await me.addPortfolioPhoto({ photoUrl: url });
      await refresh();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const updateCaption = async (id: string, caption: string) => {
    if (!data) return;
    setData({
      ...data,
      portfolioPhotos: data.portfolioPhotos.map((p) =>
        p.id === id ? { ...p, caption } : p,
      ),
    });
    // Caption save endpoint not yet exposed for individual photos; covered by a
    // future PATCH /portfolio-photos/:id. For now we keep local state only.
  };

  const addWorkHistory = async () => {
    if (!companyName.trim() || !title.trim() || !startYear.trim()) return;
    setBusy(true);
    try {
      const start = new Date(`${startYear}-01-01`);
      const end = isCurrent ? null : endYear ? new Date(`${endYear}-12-31`) : null;
      await me.addWorkHistory({
        companyName: companyName.trim(),
        title: title.trim(),
        startDate: start,
        endDate: end,
        isCurrent,
      });
      setCompanyName('');
      setTitle('');
      setStartYear('');
      setEndYear('');
      setIsCurrent(true);
      await refresh();
    } catch (err) {
      Alert.alert('Could not add', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={4} current={2} />
          <Text style={styles.title}>Show your craft</Text>
          <Text style={styles.subtitle}>Step 3 of 4 — up to 12 work photos</Text>

          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              Profiles with job photos get 3× more connection requests and employer views.
            </Text>
          </View>

          <View style={styles.photoGrid}>
            {(data?.portfolioPhotos ?? []).map((p) => (
              <View key={p.id} style={styles.photoTile}>
                <Image source={{ uri: p.photoUrl }} style={styles.photoImage} />
                <TextInput
                  placeholder="Caption"
                  placeholderTextColor={colors.textSecondary}
                  value={p.caption ?? ''}
                  onChangeText={(v) => updateCaption(p.id, v.slice(0, 100))}
                  style={styles.captionInput}
                />
              </View>
            ))}
            {(data?.portfolioPhotos.length ?? 0) < 12 ? (
              <Pressable style={[styles.photoTile, styles.photoAdd]} onPress={addPhoto}>
                <Text style={styles.photoAddText}>+</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Work history</Text>
          {(data?.workHistory ?? []).map((entry) => (
            <Card key={entry.id}>
              <Text style={typography.bodyBold}>{entry.companyName}</Text>
              <Text style={styles.workTitle}>{entry.title}</Text>
              <Text style={styles.workDates}>
                {new Date(entry.startDate).getFullYear()} –{' '}
                {entry.isCurrent ? 'Present' : new Date(entry.endDate ?? '').getFullYear()}
              </Text>
            </Card>
          ))}
          <Card>
            <Text style={typography.bodyBold}>Add a previous employer</Text>
            <Input label="Company" value={companyName} onChangeText={setCompanyName} />
            <Input label="Title" value={title} onChangeText={setTitle} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input
                label="Start year"
                keyboardType="number-pad"
                value={startYear}
                onChangeText={setStartYear}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="End year"
                keyboardType="number-pad"
                value={endYear}
                onChangeText={(v) => {
                  setEndYear(v);
                  if (v) setIsCurrent(false);
                }}
                containerStyle={{ flex: 1 }}
                helper={isCurrent ? 'Leave blank if current' : undefined}
              />
            </View>
            <Button
              variant="outline"
              label="+ Add employer"
              onPress={addWorkHistory}
              disabled={!companyName.trim() || !title.trim() || !startYear.trim()}
            />
          </Card>
        </View>

        <Button
          label="Save & continue"
          onPress={() => router.push('/(app)/profile-create-privacy')}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg },
  callout: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  calloutText: { ...typography.small, color: colors.textSecondary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  photoTile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  photoImage: { flex: 1, width: '100%' },
  captionInput: {
    fontSize: 12,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  photoAdd: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontSize: 36, color: colors.primary, fontWeight: '300' },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  workTitle: { ...typography.body, color: colors.textPrimary, marginTop: 2 },
  workDates: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
