// Mockup screen 3A — Profile creation step 1 of 4: Photo & bio
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { Button, Input, ProgressDots } from '../../src/components/ui.js';
import { ApiError, me, uploadImage } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function ProfileCreatePhoto() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.profilePhotoUrl ?? null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [unionName, setUnionName] = useState('');
  const [busy, setBusy] = useState(false);

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';

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

  const onSave = async () => {
    setBusy(true);
    try {
      await me.updateWorkerProfile({
        headline: headline || null,
        bio: bio || null,
        unionName: unionName || null,
      });
      router.push('/(app)/profile-create-skills');
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
            <ProgressDots count={4} current={0} />
            <Text style={styles.title}>Add a photo & bio</Text>
            <Text style={styles.subtitle}>Step 1 of 4</Text>

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
              placeholder="e.g. Journeyman Electrician · IBEW Local 134"
              value={headline}
              onChangeText={setHeadline}
              helper="Shown under your name on every post and in search results"
            />

            <Text style={styles.fieldLabel}>About me (optional)</Text>
            <TextInput
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, 300))}
              multiline
              numberOfLines={5}
              placeholder="Brief intro for employers and other tradespeople"
              placeholderTextColor={colors.textSecondary}
              style={styles.textarea}
            />
            <Text style={styles.charCount}>{bio.length} / 300</Text>

            <Input
              label="Union / affiliation (optional)"
              placeholder="e.g. IBEW Local 134"
              value={unionName}
              onChangeText={setUnionName}
              helper="Displayed as a badge on your posts and profile"
            />
          </View>

          <View>
            <Button label="Save & continue" onPress={onSave} loading={busy} />
            <Button
              variant="ghost"
              label="Skip for now"
              onPress={() => router.push('/(app)/profile-create-skills')}
            />
          </View>
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
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarImage: { width: 120, height: 120, borderRadius: 60 },
  avatarInitials: { ...typography.h1, color: colors.primaryDark },
  cameraDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraDotIcon: { fontSize: 16 },
  nameLine: { ...typography.bodyBold, color: colors.textPrimary },
  fieldLabel: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textarea: {
    minHeight: 100,
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
    marginBottom: spacing.md,
  },
});
