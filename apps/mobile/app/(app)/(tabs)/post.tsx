// Post tab — branches by role:
//   • employer → starts the 6-step posting wizard (Mockup 7A→7F)
//   • worker   → post composer (S16)
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AtSign, Briefcase, Camera, ChevronDown, ChevronRight, Globe, MapPin, Users, Wrench, X } from 'lucide-react-native';
import { Badge, Button, Chip } from '../../../src/components/ui.js';
import { MentionTextInput, type Mention } from '../../../src/components/mention-text-input.js';
import { ApiError, me, posts, uploadImage } from '../../../src/lib/api.js';
import { useAuth } from '../../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

const MAX_CHARS = 3000;
const WARN_CHARS = 2500;

type Audience = 'anyone' | 'connections';

export default function PostTab() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === 'employer' || user?.role === 'admin') {
      router.replace('/(app)/post-job/plan');
    }
  }, [user, router]);

  if (user?.role === 'employer' || user?.role === 'admin') return null;

  return <PostComposer />;
}

function PostComposer() {
  const router = useRouter();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<Audience>('anyone');
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);
  const [locationTag, setLocationTag] = useState<string | null>(null);
  const [tradeTag, setTradeTag] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tagged, setTagged] = useState<Mention[]>([]);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    if (photoUrls.length >= 4) {
      Alert.alert('Limit reached', 'You can add up to 4 photos per post.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add photos to your post.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // show the crop frame so the user controls the crop
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      setPhotoUrls((prev) => [...prev, url]);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setUploading(false);
    }
  };

  // Pre-fill from profile
  useEffect(() => {
    me.get()
      .then((data) => {
        if (data.workerProfile?.city && data.workerProfile?.state) {
          setLocationTag(`${data.workerProfile.city}, ${data.workerProfile.state}`);
        }
        if (data.trades.length > 0) {
          setTradeTag(data.trades[0]!.name);
        }
      })
      .catch(() => {});
  }, []);

  const charCount = content.length;
  const canPost = content.trim().length > 0 && charCount <= MAX_CHARS;

  const handlePost = async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      await posts.create({
        content: content.trim(),
        audience,
        locationTag,
        tradeTag,
        photoUrls: photoUrls.length ? photoUrls : undefined,
        mentionedUserIds: tagged.length ? tagged.map((t) => t.id) : undefined,
      });
      // Reset the whole draft so the next time the + tab opens it's blank
      // (this screen stays mounted as a tab, so state would otherwise persist).
      setContent('');
      setPhotoUrls([]);
      setLocationTag(null);
      setTradeTag(null);
      setTagged([]);
      setAudience('anyone');
      router.navigate('/(app)/(tabs)/feed');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not create post');
    } finally {
      setBusy(false);
    }
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Create post</Text>
        <Button
          label={busy ? 'Posting…' : 'Post'}
          loading={busy}
          disabled={!canPost}
          onPress={handlePost}
          style={styles.postBtn}
        />
      </View>

      <Pressable
        style={styles.hireBanner}
        onPress={() => router.push('/(app)/post-job/plan')}
        accessibilityRole="button"
      >
        <Briefcase color={colors.orange} size={18} strokeWidth={2} />
        <Text style={styles.hireBannerText}>Looking to hire? Post a job</Text>
        <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
      </Pressable>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Pressable
                style={styles.audienceBtn}
                onPress={() => setShowAudiencePicker(!showAudiencePicker)}
              >
                {audience === 'anyone' ? (
                  <Globe color={colors.textMuted} size={12} strokeWidth={2} />
                ) : (
                  <Users color={colors.textMuted} size={12} strokeWidth={2} />
                )}
                <Text style={styles.audienceLabel}>
                  {audience === 'anyone' ? 'Anyone' : 'Connections only'}
                </Text>
                <ChevronDown color={colors.textMuted} size={12} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {showAudiencePicker ? (
            <View style={styles.audiencePicker}>
              <Pressable
                style={[styles.audienceOption, audience === 'anyone' && styles.audienceOptionActive]}
                onPress={() => { setAudience('anyone'); setShowAudiencePicker(false); }}
              >
                <Globe color={audience === 'anyone' ? colors.orange : colors.textMuted} size={16} strokeWidth={2} />
                <Text style={[styles.audienceOptionLabel, audience === 'anyone' && styles.audienceOptionLabelActive]}>
                  Anyone
                </Text>
              </Pressable>
              <Pressable
                style={[styles.audienceOption, audience === 'connections' && styles.audienceOptionActive]}
                onPress={() => { setAudience('connections'); setShowAudiencePicker(false); }}
              >
                <Users color={audience === 'connections' ? colors.orange : colors.textMuted} size={16} strokeWidth={2} />
                <Text style={[styles.audienceOptionLabel, audience === 'connections' && styles.audienceOptionLabelActive]}>
                  Connections only
                </Text>
              </Pressable>
            </View>
          ) : null}

          <MentionTextInput
            inputStyle={styles.textInput}
            placeholder="Share your work, ask a question, or tag a connection with @…"
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={MAX_CHARS}
            textAlignVertical="top"
            mentions={tagged}
            onMentionsChange={setTagged}
          />

          {charCount >= WARN_CHARS ? (
            <Text style={[styles.charCount, charCount > MAX_CHARS && styles.charCountOver]}>
              {charCount}/{MAX_CHARS}
            </Text>
          ) : null}

          <View style={styles.tagRow}>
            {locationTag ? (
              <Pressable style={styles.tag} onPress={() => setLocationTag(null)}>
                <MapPin color={colors.orange} size={12} strokeWidth={2} />
                <Text style={styles.tagLabel}>{locationTag}</Text>
                <X color={colors.textMuted} size={10} strokeWidth={2} />
              </Pressable>
            ) : null}
            {tradeTag ? (
              <Pressable style={styles.tag} onPress={() => setTradeTag(null)}>
                <Wrench color={colors.orange} size={12} strokeWidth={2} />
                <Text style={styles.tagLabel}>{tradeTag}</Text>
                <X color={colors.textMuted} size={10} strokeWidth={2} />
              </Pressable>
            ) : null}
            {tagged.map((t) => (
              <Pressable
                key={t.id}
                style={styles.tag}
                onPress={() => setTagged((prev) => prev.filter((p) => p.id !== t.id))}
              >
                <AtSign color={colors.orange} size={12} strokeWidth={2} />
                <Text style={styles.tagLabel}>{t.name}</Text>
                <X color={colors.textMuted} size={10} strokeWidth={2} />
              </Pressable>
            ))}
          </View>

          {photoUrls.length > 0 || uploading ? (
            <View style={styles.photoRow}>
              {photoUrls.map((url, i) => (
                <View key={url} style={styles.photoThumb}>
                  <Image source={{ uri: url }} style={styles.photoImg} />
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => setPhotoUrls((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X color={colors.textInverse} size={12} strokeWidth={2.5} />
                  </Pressable>
                </View>
              ))}
              {uploading ? (
                <View style={[styles.photoThumb, styles.photoUploading]}>
                  <ActivityIndicator color={colors.orange} />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.toolbar}>
          <Pressable style={styles.toolbarBtn} onPress={pickPhoto} disabled={uploading}>
            <Camera color={uploading ? colors.textMuted : colors.navy} size={22} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            style={styles.toolbarBtn}
            onPress={() => {
              if (!locationTag) {
                me.get()
                  .then((data) => {
                    if (data.workerProfile?.city && data.workerProfile?.state) {
                      setLocationTag(`${data.workerProfile.city}, ${data.workerProfile.state}`);
                    }
                  })
                  .catch(() => {});
              }
            }}
          >
            <MapPin color={locationTag ? colors.orange : colors.navy} size={22} strokeWidth={1.8} />
          </Pressable>
        </View>
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
  hireBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.chipBgActive,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  hireBannerText: { ...typography.bodyBold, color: colors.navy, flex: 1 },
  postBtn: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  content: { padding: spacing.lg, flexGrow: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  authorName: { ...typography.bodyBold, color: colors.navy },
  audienceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audienceLabel: { ...typography.small, color: colors.textMuted },
  audiencePicker: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  audienceOptionActive: { backgroundColor: colors.chipBgActive },
  audienceOptionLabel: { ...typography.body, color: colors.textPrimary },
  audienceOptionLabelActive: { color: colors.navy, fontWeight: '600' },
  textInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 160,
    fontSize: 16,
    lineHeight: 24,
  },
  charCount: { ...typography.small, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },
  charCountOver: { color: colors.danger },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.chipBgActive,
  },
  tagLabel: { ...typography.small, color: colors.navy, fontWeight: '600' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photoThumb: { width: 88, height: 88, borderRadius: radius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoUploading: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
