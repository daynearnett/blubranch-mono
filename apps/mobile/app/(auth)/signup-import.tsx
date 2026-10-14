// Onboarding step 3.5 — "Want a head start?"
//
// Sits between email verification and the location step. By this point the
// account exists (registration moved to the end of the email step), so both
// import paths run authenticated and can write straight to the profile once
// the worker confirms.
//
// Two options, each hidden when the server has no credentials for it (same
// pattern as the Google sign-in button):
//
//   LinkedIn — name, photo, email. That is genuinely all the OIDC `profile`
//              and `email` scopes return; LinkedIn has not exposed positions
//              or skills to new apps since Aug 2023.
//   Resume   — work history, skills, headline, bio. This is the one that
//              actually fills the profile out.
//
// Nothing is written until the worker sees what was found and taps "Use
// this". A bad parse should never silently overwrite what they typed, and
// POST /users/me/work-history is append-only with no DELETE route, so a
// double-run would otherwise duplicate every job.

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText, Link2, Sparkles } from 'lucide-react-native';
import { Button } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup } from '../../src/lib/signup-context.js';
import {
  ApiError,
  imports,
  me,
  type LinkedInImportResult,
  type ResumeImportResult,
} from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

type Stage = 'ask' | 'choose' | 'working' | 'review';

/** What we found, flattened across both sources. */
interface Found {
  firstName?: string;
  lastName?: string;
  pictureUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  workHistory?: ResumeImportResult['workHistory'];
  skillIds?: number[];
}

export default function SignupImport() {
  const router = useRouter();
  const { update } = useSignup();
  const { user, setUser } = useAuth();

  const [stage, setStage] = useState<Stage>('ask');
  const [config, setConfig] = useState<{ linkedin: boolean; resume: boolean } | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    imports
      .config()
      .then(setConfig)
      // A failed config read just means no options render; the worker can
      // still skip through.
      .catch(() => setConfig({ linkedin: false, resume: false }));
  }, []);

  const next = useCallback(() => {
    update({ importAnswered: true });
    router.push('/(auth)/signup-location');
  }, [router, update]);

  // ── LinkedIn: open the authorize URL, come back via the deep link ──
  const handleLinkedInTicket = useCallback(async (ticket: string) => {
    setStage('working');
    try {
      const result: LinkedInImportResult = await imports.linkedIn(ticket);
      setFound({
        firstName: result.firstName || undefined,
        lastName: result.lastName || undefined,
        pictureUrl: result.pictureUrl,
      });
      setStage('review');
    } catch (err) {
      setStage('choose');
      Alert.alert(
        "Couldn't reach LinkedIn",
        err instanceof ApiError ? err.message : 'Give it another shot, or fill things in yourself.',
      );
    }
  }, []);

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      if (!url.includes('linkedin-import')) return;
      const query = url.split('?')[1] ?? '';
      const params = new URLSearchParams(query);
      const ticket = params.get('ticket');
      const error = params.get('error');
      if (ticket) void handleLinkedInTicket(ticket);
      else if (error && error !== 'cancelled') {
        setStage('choose');
        Alert.alert("Couldn't reach LinkedIn", 'Give it another shot, or fill things in yourself.');
      } else setStage('choose');
    };
    const sub = Linking.addEventListener('url', onUrl);
    return () => sub.remove();
  }, [handleLinkedInTicket]);

  const startLinkedIn = async () => {
    setStage('working');
    try {
      const { authorizeUrl } = await imports.startLinkedIn();
      await Linking.openURL(authorizeUrl);
      // The deep-link listener above takes it from here.
    } catch (err) {
      setStage('choose');
      Alert.alert(
        "Couldn't open LinkedIn",
        err instanceof ApiError ? err.message : 'Give it another shot.',
      );
    }
  };

  // ── Resume: pick a PDF, parse it, review ──
  const startResume = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setStage('working');
    try {
      const result = await imports.resume(asset.uri, asset.name ?? 'resume.pdf');
      setFound({
        headline: result.headline,
        bio: result.bio,
        workHistory: result.workHistory,
        skillIds: result.skillIds,
      });
      setStage('review');
    } catch (err) {
      setStage('choose');
      Alert.alert(
        "Couldn't read that resume",
        err instanceof ApiError
          ? err.message
          : 'Make sure it\'s a PDF under 10MB, or fill things in yourself.',
      );
    }
  };

  // ── Apply what was found ──
  const applyFound = async () => {
    if (!found) return;
    setSaving(true);
    try {
      if (found.headline || found.bio) {
        await me.updateWorkerProfile({
          ...(found.headline ? { headline: found.headline } : {}),
          ...(found.bio ? { bio: found.bio } : {}),
        });
      }
      if (found.pictureUrl) {
        await me.updatePhoto(found.pictureUrl);
        if (user) setUser({ ...user, profilePhotoUrl: found.pictureUrl });
      }
      if (found.skillIds?.length) {
        await me.setSkills({ skillIds: found.skillIds });
      }
      for (const job of found.workHistory ?? []) {
        await me.addWorkHistory({
          companyName: job.companyName,
          title: job.title,
          // The parser gives month precision (YYYY-MM); the API schema
          // coerces to a Date, so anchor each to the first of the month.
          startDate: new Date(`${job.startDate}-01T00:00:00Z`),
          endDate: job.endDate ? new Date(`${job.endDate}-01T00:00:00Z`) : null,
          isCurrent: job.isCurrent,
        });
      }
      // Pre-fill the step the worker lands on next.
      const current = found.workHistory?.find((j) => j.isCurrent);
      if (current) {
        update({ currentCompany: current.companyName, currentTitle: current.title });
      }
      if (found.firstName) update({ firstName: found.firstName });
      if (found.lastName) update({ lastName: found.lastName });
      next();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.message : 'Give it another shot.',
      );
    } finally {
      setSaving(false);
    }
  };

  const anyOption = config?.linkedin || config?.resume;

  return (
    <SignupShell progress={45}>
      <View>
        {stage === 'ask' ? (
          <>
            <Text style={styles.title}>Want a head start?</Text>
            <Text style={styles.subtitle}>
              We can pull your details in so you're not typing everything twice.
            </Text>
            <View style={styles.illustration}>
              <Sparkles size={28} color={colors.navy} strokeWidth={2} />
            </View>
          </>
        ) : null}

        {stage === 'choose' ? (
          <>
            <Text style={styles.title}>Where should we pull from?</Text>
            <Text style={styles.subtitle}>Nothing gets saved until you've had a look.</Text>

            {config?.linkedin ? (
              <OptionRow
                icon={<Link2 size={20} color={colors.navy} strokeWidth={2} />}
                title="Connect LinkedIn"
                subtitle="Your name and photo"
                onPress={startLinkedIn}
              />
            ) : null}
            {config?.resume ? (
              <OptionRow
                icon={<FileText size={20} color={colors.navy} strokeWidth={2} />}
                title="Upload a resume"
                subtitle="Work history, skills and a bio — PDF"
                onPress={startResume}
              />
            ) : null}
            {!anyOption ? (
              <Text style={styles.subtitle}>
                Nothing to connect just yet — we'll ask for the basics on the next few screens.
              </Text>
            ) : null}
          </>
        ) : null}

        {stage === 'working' ? (
          <View style={styles.working}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.workingText}>Reading that over…</Text>
          </View>
        ) : null}

        {stage === 'review' && found ? (
          <>
            <Text style={styles.title}>Here's what we found</Text>
            <Text style={styles.subtitle}>
              Have a look before we save it. You can change any of it later.
            </Text>
            <View style={styles.reviewCard}>
              {found.firstName ? (
                <FoundRow label="Name" value={`${found.firstName} ${found.lastName ?? ''}`.trim()} />
              ) : null}
              {found.pictureUrl ? <FoundRow label="Photo" value="Imported" /> : null}
              {found.headline ? <FoundRow label="Headline" value={found.headline} /> : null}
              {found.bio ? <FoundRow label="About" value={found.bio} /> : null}
              {found.workHistory?.length ? (
                <FoundRow
                  label="Work history"
                  value={found.workHistory
                    .map((j) => `${j.title} at ${j.companyName}`)
                    .join('\n')}
                />
              ) : null}
              {found.skillIds?.length ? (
                <FoundRow label="Skills" value={`${found.skillIds.length} matched`} />
              ) : null}
              {!found.firstName &&
              !found.headline &&
              !found.bio &&
              !found.workHistory?.length ? (
                <Text style={styles.foundValue}>
                  Nothing we could use, unfortunately. The next few screens take a minute.
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      <View>
        {stage === 'ask' ? (
          <>
            <Button
              label="Yes, save me the typing"
              onPress={() => setStage('choose')}
              disabled={!config}
            />
            <Pressable onPress={next} style={styles.skipBtn}>
              <Text style={styles.skipLabel}>I'll do it myself</Text>
            </Pressable>
          </>
        ) : null}

        {stage === 'choose' ? (
          <Pressable onPress={next} style={styles.skipBtn}>
            <Text style={styles.skipLabel}>Skip for now</Text>
          </Pressable>
        ) : null}

        {stage === 'review' ? (
          <>
            <Button label="Use this" onPress={applyFound} loading={saving} />
            <Pressable onPress={next} style={styles.skipBtn} disabled={saving}>
              <Text style={styles.skipLabel}>No thanks, I'll type it</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SignupShell>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.optionIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function FoundRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.foundRow}>
      <View style={styles.foundCheck}>
        <Check size={12} color={colors.textInverse} strokeWidth={3} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.foundLabel}>{label}</Text>
        <Text style={styles.foundValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  illustration: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  optionPressed: { opacity: 0.6 },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { ...typography.bodyBold, color: colors.textPrimary },
  optionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  working: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  workingText: { ...typography.body, color: colors.textMuted },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  foundRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  foundCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  foundLabel: { ...typography.caption, color: colors.textSecondary },
  foundValue: { ...typography.body, color: colors.textPrimary },
  skipBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  skipLabel: { ...typography.body, color: colors.textSecondary, textDecorationLine: 'underline' },
});
