// "Complete your profile" — the destination for the Quick Apply readiness
// gate, and the app's first real in-app profile editor.
//
// Until now the only way to set these fields was the one-shot onboarding
// wizard: the profile tab's "Add your skills" card and Settings → "Profile &
// visibility" both dead-ended in a "coming soon" Alert. Both now land here.
//
// Shape: a checklist driven by GET /users/me/apply-readiness. Items the
// server still wants are listed first and open expanded; items already
// satisfied collapse into a done list the worker can still reopen and edit.
// Each section saves on its own through the existing /users/me/* endpoints,
// so a half-finished session is never lost.
//
// Query params:
//   returnTo — job id to send the worker back to once the gate is green
//   focus    — requirement key to auto-expand (the gate sheet rows deep-link
//              straight to the item the worker tapped)

import { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Tag,
  Type,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button, Chip, Input } from '../../src/components/ui.js';
import { StatePicker } from '../../src/components/state-picker.js';
import { ProgressBar } from '../../src/components/progress-bar.js';
import {
  ApiError,
  me,
  reference,
  uploadImage,
  type ApplyReadiness,
  type ApplyRequirementKey,
  type MeResponse,
} from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, layout, radius, spacing, typography } from '../../src/theme.js';

const ICONS: Record<ApplyRequirementKey, LucideIcon> = {
  phone: Phone,
  photo: Camera,
  headline: Type,
  trade: Tag,
  location: MapPin,
  experience: Briefcase,
};

const TITLES: Record<ApplyRequirementKey, string> = {
  phone: 'Phone number',
  photo: 'Profile photo',
  headline: 'Headline',
  trade: 'Your trade',
  location: 'Where you work',
  experience: 'Work history',
};

/** Fixed display order, independent of the server's missing-first ordering. */
const ORDER: ApplyRequirementKey[] = [
  'photo',
  'headline',
  'trade',
  'location',
  'experience',
  'phone',
];

export default function ProfileCompleteScreen() {
  const { returnTo, focus } = useLocalSearchParams<{ returnTo?: string; focus?: string }>();
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [readiness, setReadiness] = useState<ApplyReadiness | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ApplyRequirementKey | null>(null);
  const [celebrated, setCelebrated] = useState(false);

  const refresh = useCallback(async () => {
    const [next, data] = await Promise.all([me.applyReadiness(), me.get()]);
    setReadiness(next);
    setProfile(data);
    return next;
  }, []);

  // Re-check on focus so returning from verify-phone ticks the phone row
  // without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh()
        .then((next) => {
          if (!active) return;
          // Open the item the gate sheet pointed at, else the first unmet one.
          setOpen((current) => {
            if (current) return current;
            const wanted = focus as ApplyRequirementKey | undefined;
            if (wanted && next.missing.some((m) => m.key === wanted)) return wanted;
            return (next.missing[0]?.key as ApplyRequirementKey) ?? null;
          });
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [refresh, focus]),
  );

  const done = readiness?.ready === true;
  const total = ORDER.length;
  const satisfied = readiness?.satisfied.length ?? 0;

  // When the last item lands, confirm before handing them back to the job.
  useEffect(() => {
    if (!done || celebrated || loading) return;
    setCelebrated(true);
    setOpen(null);
  }, [done, celebrated, loading]);

  const finish = () => {
    if (returnTo) router.replace(`/(app)/jobs/${returnTo}`);
    else router.replace('/(app)/(tabs)/profile');
  };

  const sectionProps = (key: ApplyRequirementKey) => ({
    key,
    requirement: key,
    isOpen: open === key,
    isDone: readiness?.satisfied.includes(key) ?? false,
    onToggle: () => setOpen((c) => (c === key ? null : key)),
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Complete your profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTitle}>
                {done ? "You're ready to apply" : 'Ready to apply'}
              </Text>
              <Text style={styles.summaryCount}>
                {satisfied}/{total}
              </Text>
            </View>
            <ProgressBar progress={Math.round((satisfied / total) * 100)} />
            <Text style={styles.summaryHint}>
              {done
                ? 'Quick Apply is unlocked. These are the details employers see on your application.'
                : 'Employers see these before they see your application. Finish once and Quick Apply works from then on.'}
            </Text>
          </View>

          {ORDER.map((key) => (
            <Section {...sectionProps(key)}>
              {key === 'photo' ? (
                <PhotoField
                  photoUrl={profile?.profilePhotoUrl ?? null}
                  onSaved={async (url) => {
                    if (user) setUser({ ...user, profilePhotoUrl: url });
                    await refresh();
                  }}
                />
              ) : null}
              {key === 'headline' ? (
                <HeadlineField profile={profile} onSaved={refresh} />
              ) : null}
              {key === 'trade' ? <TradeField profile={profile} onSaved={refresh} /> : null}
              {key === 'location' ? <LocationField profile={profile} onSaved={refresh} /> : null}
              {key === 'experience' ? (
                <ExperienceField profile={profile} onSaved={refresh} />
              ) : null}
              {key === 'phone' ? (
                <PhoneField
                  verified={readiness?.satisfied.includes('phone') ?? false}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/verify-phone',
                      params: returnTo ? { returnTo } : {},
                    })
                  }
                />
              ) : null}
            </Section>
          ))}

          <Button
            label={done ? (returnTo ? 'Back to the job' : 'Done') : 'Save and close'}
            onPress={finish}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Collapsible section shell ───────────────────────────────────
function Section({
  requirement,
  isOpen,
  isDone,
  onToggle,
  children,
}: {
  requirement: ApplyRequirementKey;
  isOpen: boolean;
  isDone: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = ICONS[requirement];
  const Chevron = isOpen ? ChevronUp : ChevronDown;
  return (
    <View style={[styles.section, isOpen && styles.sectionOpen]}>
      <Pressable style={styles.sectionHeader} onPress={onToggle} accessibilityRole="button">
        <View style={[styles.statusDot, isDone && styles.statusDotDone]}>
          {isDone ? (
            <Check size={14} color={colors.textInverse} strokeWidth={3} />
          ) : (
            <Icon size={14} color={colors.navy} strokeWidth={2} />
          )}
        </View>
        <Text style={[styles.sectionTitle, isDone && styles.sectionTitleDone]}>
          {TITLES[requirement]}
        </Text>
        <Chevron size={18} color={colors.textMuted} strokeWidth={2} />
      </Pressable>
      {isOpen ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

// ── Photo ───────────────────────────────────────────────────────
function PhotoField({
  photoUrl,
  onSaved,
}: {
  photoUrl: string | null;
  onSaved: (url: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
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
      await me.updatePhoto(url);
      await onSaved(url);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={pick} accessibilityLabel="Choose a profile photo">
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Camera size={26} color={colors.navy} strokeWidth={2} />
          </View>
        )}
      </Pressable>
      <Text style={styles.fieldHint}>Crews hire faces. A clear headshot is plenty.</Text>
      <Button
        label={photoUrl ? 'Change photo' : 'Choose a photo'}
        variant="outline"
        onPress={pick}
        loading={busy}
        style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}
      />
    </View>
  );
}

// ── Headline + bio ──────────────────────────────────────────────
function HeadlineField({
  profile,
  onSaved,
}: {
  profile: MeResponse | null;
  onSaved: () => Promise<unknown>;
}) {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeadline(profile?.workerProfile?.headline ?? profile?.workerProfile?.currentTitle ?? '');
    setBio(profile?.workerProfile?.bio ?? '');
  }, [profile]);

  const save = async () => {
    setBusy(true);
    try {
      await me.updateWorkerProfile({ headline: headline.trim() || null, bio: bio.trim() || null });
      await onSaved();
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Input
        label="Headline"
        value={headline}
        onChangeText={setHeadline}
        maxLength={200}
        placeholder="Journeyman electrician"
        helper="One line on what you do."
      />
      <Input
        label="About you (optional)"
        value={bio}
        onChangeText={setBio}
        // The server caps bio at 300 characters, not 500.
        maxLength={300}
        multiline
        numberOfLines={4}
        placeholder="What you work on, the tools you run, what you're after."
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />
      <Button label="Save" onPress={save} loading={busy} disabled={!headline.trim()} />
    </View>
  );
}

// ── Trade ───────────────────────────────────────────────────────
function TradeField({
  profile,
  onSaved,
}: {
  profile: MeResponse | null;
  onSaved: () => Promise<unknown>;
}) {
  const [trades, setTrades] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reference
      .trades()
      .then(setTrades)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setSelected((profile?.trades ?? []).map((t) => t.id));
  }, [profile]);

  const toggle = (id: number) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id],
    );

  const save = async () => {
    setBusy(true);
    try {
      // POST /users/me/trades replaces the whole set, so send everything.
      await me.setTrades({ tradeIds: selected });
      await onSaved();
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={styles.fieldHint}>Pick up to 3. This is the first thing employers filter on.</Text>
      <View style={styles.chipWrap}>
        {trades.map((t) => (
          <Chip
            key={t.id}
            label={t.name}
            active={selected.includes(t.id)}
            onPress={() => toggle(t.id)}
          />
        ))}
      </View>
      <Button label="Save" onPress={save} loading={busy} disabled={selected.length === 0} />
    </View>
  );
}

// ── Location ────────────────────────────────────────────────────
function LocationField({
  profile,
  onSaved,
}: {
  profile: MeResponse | null;
  onSaved: () => Promise<unknown>;
}) {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCity(profile?.workerProfile?.city ?? '');
    setState(profile?.workerProfile?.state ?? '');
    setZipCode(profile?.workerProfile?.zipCode ?? '');
  }, [profile]);

  const save = async () => {
    setBusy(true);
    try {
      await me.updateWorkerProfile({
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
      });
      await onSaved();
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Input label="City" value={city} onChangeText={setCity} maxLength={100} placeholder="Columbus" />
      <StatePicker value={state} onChange={setState} />
      <Input
        label="ZIP (optional)"
        value={zipCode}
        onChangeText={setZipCode}
        maxLength={10}
        keyboardType="number-pad"
        helper="Sharpens how far jobs show as being from you."
      />
      <Button label="Save" onPress={save} loading={busy} disabled={!city.trim() || !state.trim()} />
    </View>
  );
}

// ── Experience ──────────────────────────────────────────────────
function ExperienceField({
  profile,
  onSaved,
}: {
  profile: MeResponse | null;
  onSaved: () => Promise<unknown>;
}) {
  const [seeking, setSeeking] = useState(false);
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const wp = profile?.workerProfile;
    setSeeking(wp?.jobAvailability === 'actively_looking' && !wp?.currentCompany);
    setCompany(wp?.currentCompany ?? '');
    setTitle(wp?.currentTitle ?? '');
  }, [profile]);

  const save = async () => {
    setBusy(true);
    try {
      await me.updateWorkerProfile(
        seeking
          ? { currentCompany: null, currentTitle: null, jobAvailability: 'actively_looking' }
          : { currentCompany: company.trim(), currentTitle: title.trim() },
      );
      await onSaved();
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const canSave = seeking || (company.trim() !== '' && title.trim() !== '');

  return (
    <View>
      <Text style={styles.fieldHint}>Where you work now — or tell us you're looking.</Text>
      {!seeking ? (
        <>
          <Input
            label="Company"
            value={company}
            onChangeText={setCompany}
            maxLength={200}
            placeholder="Morrow Electric LLC"
          />
          <Input
            label="Job title"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            placeholder="Service electrician"
          />
        </>
      ) : null}
      <Pressable
        style={styles.checkRow}
        onPress={() => setSeeking((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: seeking }}
      >
        <View style={[styles.checkbox, seeking && styles.checkboxActive]}>
          {seeking ? <Check color={colors.textInverse} size={14} strokeWidth={3} /> : null}
        </View>
        <Text style={styles.checkLabel}>I'm between jobs and looking for work</Text>
      </Pressable>
      <Button label="Save" onPress={save} loading={busy} disabled={!canSave} />
    </View>
  );
}

// ── Phone ───────────────────────────────────────────────────────
function PhoneField({ verified, onPress }: { verified: boolean; onPress: () => void }) {
  return (
    <View>
      <Text style={styles.fieldHint}>
        {verified
          ? 'Verified. Employers can reach you about applications.'
          : "We'll text you a code. Employers never see your number until you apply."}
      </Text>
      <Button
        label={verified ? 'Change number' : 'Verify my phone'}
        variant={verified ? 'outline' : 'primary'}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.bodyBold, color: colors.navy },
  content: { padding: layout.screenPaddingH, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryTitle: { ...typography.bodyBold, color: colors.navy },
  summaryCount: { ...typography.bodyBold, color: colors.navy },
  summaryHint: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sectionOpen: { borderColor: colors.navy },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  sectionTitleDone: { color: colors.textSecondary },
  sectionBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotDone: { backgroundColor: colors.success },
  fieldHint: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.navy },
  checkLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
