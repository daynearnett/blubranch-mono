// Final onboarding page — photo, headline (defaults from job title) & about.
// This is the last step: finishing drops the user into their feed.
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { Button, Input } from '../../src/components/ui.js';
import { ApiError, me, uploadImage, type MeResponse } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

// Template-based bio. Swapped for a Claude-generated version once an
// ANTHROPIC_API_KEY is wired (see /ai/generate-bio task) — same inputs.
function buildBio(p: {
  title: string | null;
  company: string | null;
  city: string;
  state: string;
  trades: string[];
}): string {
  const title = p.title?.trim();
  const loc = p.city && p.state ? `${p.city}, ${p.state}` : p.city || p.state || '';
  let lead = title ? title : 'Skilled tradesperson';
  const t = p.trades.slice(0, 3).map((x) => x.toLowerCase());
  if (t.length) {
    const skills = t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
    lead += ` specializing in ${skills}`;
  }
  if (loc) lead += ` based in ${loc}`;
  let bio = `${lead}.`;
  if (p.company) bio += ` Currently with ${p.company}.`;
  bio += ' Open to connecting with other pros and new opportunities.';
  return bio.slice(0, 300);
}

export default function ProfileCreatePhoto() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.profilePhotoUrl ?? null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';

  // Pull the profile saved during signup so we can default the headline from
  // the job title and seed the bio generator.
  useEffect(() => {
    me.get()
      .then((data) => {
        setProfile(data);
        if (data.workerProfile?.currentTitle) setHeadline(data.workerProfile.currentTitle);
      })
      .catch(() => {});
  }, []);

  const generateBio = () => {
    const wp = profile?.workerProfile;
    setBio(
      buildBio({
        title: wp?.currentTitle ?? null,
        company: wp?.currentCompany ?? null,
        city: wp?.city ?? '',
        state: wp?.state ?? '',
        trades: (profile?.trades ?? []).map((t) => t.name),
      }),
    );
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      setPhotoUrl(url);
      if (user) setUser({ ...user, profilePhotoUrl: url });
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const onFinish = async () => {
    setBusy(true);
    try {
      await me.updateWorkerProfile({ headline: headline || null, bio: bio || null });
      router.replace('/(app)/(tabs)/feed');
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            <Text style={styles.title}>Add a photo & bio</Text>
            <Text style={styles.subtitle}>Last step — then you're in.</Text>

            <View style={styles.avatarWrap}>
              <Pressable onPress={pickPhoto} style={styles.avatar}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials || '+'}</Text>
                )}
                <View style={styles.cameraDot}>
                  <Text style={styles.cameraDotIcon}>📷</Text>
                </View>
              </Pressable>
              <Text style={styles.nameLine}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>

            <Input
              label="Profile headline"
              placeholder="e.g. Journeyman Electrician"
              value={headline}
              onChangeText={setHeadline}
            />

            <View style={styles.aboutHeader}>
              <Text style={styles.fieldLabel}>About me</Text>
              <Pressable style={styles.generateBtn} onPress={generateBio} hitSlop={8}>
                <Sparkles color={colors.primary} size={14} strokeWidth={2} />
                <Text style={styles.generateText}>Generate</Text>
              </Pressable>
            </View>
            <TextInput
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, 300))}
              multiline
              placeholder="Tap Generate for a starter bio, then edit to taste."
              placeholderTextColor={colors.textSecondary}
              style={styles.textarea}
            />
            <Text style={styles.charCount}>{bio.length} / 300</Text>
          </View>

          <Button
            variant="ctaDark"
            label="Take me to my feed"
            onPress={onFinish}
            loading={busy}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarInitials: { ...typography.h1, color: colors.primaryDark },
  cameraDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraDotIcon: { fontSize: 15 },
  nameLine: { ...typography.bodyBold, color: colors.textPrimary },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  fieldLabel: { ...typography.small, fontWeight: '600' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  generateText: { ...typography.small, color: colors.primary, fontWeight: '600' },
  textarea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
});
