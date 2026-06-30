// In-app bug reporter (Phase 7 parity). Title + description + optional
// screenshot; app version / platform / device are auto-attached. Posts to
// /issues, which surfaces in the admin Bug-reports queue.
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
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Camera, X } from 'lucide-react-native';
import { Button, Input } from '../../src/components/ui.js';
import { ApiError, issues as issuesApi, uploadImage } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function ReportBug() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const platform = Platform.OS;
  const deviceInfo = `${Device.modelName ?? 'Unknown device'} · ${platform} ${Platform.Version}`;

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  const pickScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      setScreenshotUrl(url);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await issuesApi.create({
        title: title.trim(),
        description: description.trim(),
        screenshotUrl: screenshotUrl ?? undefined,
        appVersion,
        platform,
        deviceInfo,
      });
      Alert.alert('Thanks!', "Your report was sent to the team. We'll take a look.", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Could not send', err instanceof ApiError ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close">
          <X color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Report a bug</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Found something broken or off? Tell us what happened — it goes straight to the team.
          </Text>

          <Input
            label="What went wrong?"
            placeholder="e.g. App crashed when I tapped Apply"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>Details</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Steps to reproduce, what you expected, what happened…"
            placeholderTextColor={colors.textSecondary}
            style={styles.textarea}
            textAlignVertical="top"
          />

          {screenshotUrl ? (
            <View style={styles.shotRow}>
              <Image source={{ uri: screenshotUrl }} style={styles.shot} />
              <Pressable style={styles.shotRemove} onPress={() => setScreenshotUrl(null)}>
                <X color={colors.textInverse} size={12} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.attachBtn} onPress={pickScreenshot} disabled={uploading}>
              <Camera color={uploading ? colors.textMuted : colors.navy} size={18} strokeWidth={1.8} />
              <Text style={styles.attachText}>{uploading ? 'Uploading…' : 'Attach a screenshot (optional)'}</Text>
            </Pressable>
          )}

          <Text style={styles.meta}>
            Auto-attached: v{appVersion} · {deviceInfo}
          </Text>

          <Button
            variant="ctaDark"
            label="Send report"
            onPress={onSubmit}
            loading={busy}
            disabled={!canSubmit}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, color: colors.navy },
  scroll: { padding: spacing.lg },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  fieldLabel: { ...typography.small, fontWeight: '600', marginBottom: spacing.xs, color: colors.textPrimary },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  attachText: { ...typography.body, color: colors.navy, fontWeight: '600' },
  shotRow: { marginVertical: spacing.md },
  shot: { width: 120, height: 120, borderRadius: radius.md },
  shotRemove: {
    position: 'absolute',
    top: 6,
    left: 102,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
