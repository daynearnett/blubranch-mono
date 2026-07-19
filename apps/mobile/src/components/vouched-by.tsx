// "Vouched by" list — confirmed "worked together" vouches with their shared
// context line. Used on the own-profile tab and the public profile screen.
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ProfileVouch } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

/** "Worked together at Turner Construction · 2023–2024" (missing parts omitted). */
export function vouchContextLine(v: ProfileVouch): string {
  const where = v.companyName ? `Worked together at ${v.companyName}` : 'Worked together';
  const years =
    v.startYear && v.endYear && v.startYear !== v.endYear
      ? `${v.startYear}–${v.endYear}`
      : v.startYear ?? v.endYear;
  return years ? `${where} · ${years}` : where;
}

export function VouchedByList({ vouches }: { vouches: ProfileVouch[] }) {
  return (
    <View>
      {vouches.map((v, i) => {
        const initials =
          `${v.voucher.firstName[0] ?? ''}${v.voucher.lastName[0] ?? ''}`.toUpperCase();
        return (
          <View key={v.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            {v.voucher.profilePhotoUrl ? (
              <Image source={{ uri: v.voucher.profilePhotoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.rowText}>
              <Text style={typography.bodyBold}>
                {v.voucher.firstName} {v.voucher.lastName}
              </Text>
              <Text style={styles.context}>{vouchContextLine(v)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    backgroundColor: colors.surface,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { ...typography.small, fontWeight: '700', color: colors.navy },
  rowText: { flex: 1 },
  context: { ...typography.small, color: colors.textMuted, marginTop: 1 },
});
