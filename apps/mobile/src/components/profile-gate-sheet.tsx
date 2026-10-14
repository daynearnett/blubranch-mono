// Quick Apply readiness gate. Shown instead of the apply sheet when a
// worker's profile is missing something an employer needs to see.
//
// Two entry points, both in the same places QuickApplyModal is mounted:
//   1. A pre-check on tapping Quick Apply (me.applyReadiness) — the common
//      path, so the worker never watches an apply fail.
//   2. The 403 backstop, when readiness changed between the check and the
//      POST (or an older client skipped the pre-check).
//
// The rows are rendered straight from the server's `missing` list — label,
// hint and destination all come from services/apply-readiness.ts, so this
// component holds no second copy of the rules.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Camera,
  ChevronRight,
  MapPin,
  Phone,
  Tag,
  Type,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Button } from './ui.js';
import type { ApplyRequirementKey, MissingRequirement } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

const ICONS: Record<ApplyRequirementKey, LucideIcon> = {
  phone: Phone,
  photo: Camera,
  headline: Type,
  trade: Tag,
  location: MapPin,
  experience: Briefcase,
};

interface Props {
  visible: boolean;
  missing: MissingRequirement[];
  /** Job the worker was trying to apply to; used to send them back after. */
  returnTo?: string;
  onClose: () => void;
}

export function ProfileGateSheet({ visible, missing, returnTo, onClose }: Props) {
  const router = useRouter();

  const go = (route: string) => {
    onClose();
    // Close first, then navigate — the same ordering QuickApplyModal uses for
    // its verify-phone hand-off, so the sheet isn't left under the new screen.
    const [pathname, query] = route.split('?');
    const params: Record<string, string> = returnTo ? { returnTo } : {};
    for (const pair of query?.split('&') ?? []) {
      const [k, v] = pair.split('=');
      if (k && v) params[k] = v;
    }
    router.push({ pathname: pathname as never, params });
  };

  const goComplete = () => go('/(app)/profile-complete');

  const count = missing.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.grabHandle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>FINISH YOUR PROFILE TO APPLY</Text>
              <Text style={styles.title}>
                {count === 1 ? 'One thing left' : `${count} things left`}
              </Text>
              <Text style={styles.subtitle}>
                Employers see this before they see your application. Fill it in once and Quick
                Apply works from then on.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} bounces={false}>
            {missing.map((item) => {
              const Icon = ICONS[item.key] ?? Briefcase;
              return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => go(item.route)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.iconCircle}>
                    <Icon size={18} color={colors.navy} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowHint}>{item.hint}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
                </Pressable>
              );
            })}
          </ScrollView>

          <Button label="Complete my profile" onPress={goComplete} />
          <Pressable onPress={onClose} style={styles.laterBtn} accessibilityLabel="Not now">
            <Text style={styles.laterLabel}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  grabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  eyebrow: {
    ...typography.caption,
    color: colors.navy,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.small, color: colors.textSecondary },
  close: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  // Capped so a six-item list can't push the CTA off a short screen.
  list: { maxHeight: 320, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { opacity: 0.6 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chipBgActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  laterBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  laterLabel: { ...typography.body, color: colors.textSecondary },
});
