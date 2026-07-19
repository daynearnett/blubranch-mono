// Trade Card — the wallet-style verified credential card (DIFFERENTIATION C1).
// Renders GET /users/me/trade-card: identity band, trade + experience +
// location, union chip, license rows with status + expiry chips, cert rows,
// confirmed-vouch count. "Share my card" sends the public OG page URL
// (GET /share/card/:slug) through the native share sheet.
//
// The steel-blue band is a solid fill — expo-linear-gradient isn't installed,
// so the brand gradient (#B0C4DE→#4682B4) collapses to its anchor color.
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Share2, Shield } from 'lucide-react-native';
import { Badge, Button } from '../../src/components/ui.js';
import { VerifiedBadge } from '../../src/components/verified-badge.js';
import {
  ApiError,
  apiBaseUrl,
  vouches,
  type LicenseRecord,
  type TradeCard,
} from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const EXPERIENCE_LABEL: Record<string, string> = {
  years_0_2: '0–2 years',
  years_3_5: '3–5 years',
  years_6_10: '6–10 years',
  years_11_15: '11–15 years',
  years_16_20: '16–20 years',
  years_20_plus: '20+ years',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Expires Sep 2026" chip — amber inside 60 days, red inside 14 or past. */
function expiryChip(expiresAt: string): { label: string; tone: 'ok' | 'amber' | 'red' } {
  const d = new Date(expiresAt);
  const days = (d.getTime() - Date.now()) / DAY_MS;
  const label = `Expires ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (days < 14) return { label, tone: 'red' };
  if (days < 60) return { label, tone: 'amber' };
  return { label, tone: 'ok' };
}

function statusBadge(status: LicenseRecord['status']) {
  if (status === 'verified') return <VerifiedBadge size="mini" />;
  if (status === 'expired') return <Badge label="Expired" tone="danger" />;
  if (status === 'rejected') return <Badge label="Rejected" tone="danger" />;
  return <Badge label="Pending" tone="neutral" />;
}

export default function TradeCardScreen() {
  const router = useRouter();
  const [card, setCard] = useState<TradeCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    vouches
      .tradeCard()
      .then(setCard)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your card'),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onShare = async () => {
    if (!card?.slug) return;
    const url = `${apiBaseUrl()}/share/card/${card.slug}`;
    try {
      await Share.share({
        message: `${card.firstName} ${card.lastName}'s Trade Card on BluBranch`,
        url,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  const fullName = card ? `${card.firstName} ${card.lastName}` : '';
  const initials = card
    ? `${card.firstName[0] ?? ''}${card.lastName[0] ?? ''}`.toUpperCase()
    : '';
  const location = card?.city && card?.state ? `${card.city}, ${card.state}` : null;
  const experience = card?.experienceLevel ? EXPERIENCE_LABEL[card.experienceLevel] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Trade Card</Text>
        <View style={styles.backBtn} />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !card ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.navy} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            {/* Steel-blue identity band */}
            <View style={styles.band}>
              <Text style={styles.eyebrow}>BLUBRANCH TRADE CARD</Text>
              <View style={styles.bandRow}>
                {card.profilePhotoUrl ? (
                  <Image source={{ uri: card.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.bandText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{fullName}</Text>
                    {card.isVerified ? <VerifiedBadge size="mini" /> : null}
                  </View>
                  {location ? <Text style={styles.bandLocation}>{location}</Text> : null}
                </View>
              </View>
            </View>

            {/* Card body */}
            <View style={styles.body}>
              {card.trade || experience ? (
                <Text style={styles.tradeLine}>
                  {[card.trade, experience].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {card.unionName ? (
                <View style={styles.unionRow}>
                  <Badge label={card.unionName} tone="primary" />
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Licenses</Text>
              {card.licenses.length === 0 ? (
                <View style={styles.emptyLicenses}>
                  <Text style={styles.emptyText}>
                    Nothing on the card yet. Add a license — verified cards get found more.
                  </Text>
                  <Pressable
                    style={styles.addLicenseRow}
                    onPress={() => router.push('/(app)/verifications')}
                  >
                    <Shield color={colors.navy} size={16} strokeWidth={2} />
                    <Text style={styles.addLicenseLabel}>Add a license</Text>
                    <ChevronRight color={colors.textMuted} size={16} strokeWidth={2} />
                  </Pressable>
                </View>
              ) : (
                card.licenses.map((lic, i) => {
                  const expiry = lic.expiresAt ? expiryChip(lic.expiresAt) : null;
                  return (
                    <View key={lic.id} style={[styles.licenseRow, i > 0 && styles.rowBorder]}>
                      <View style={styles.licenseText}>
                        <Text style={typography.bodyBold}>{lic.type}</Text>
                        <Text style={styles.licenseMeta}>{lic.issuingState}</Text>
                        {expiry ? (
                          <View
                            style={[
                              styles.expiryChip,
                              expiry.tone === 'amber' && styles.expiryAmber,
                              expiry.tone === 'red' && styles.expiryRed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.expiryLabel,
                                expiry.tone === 'amber' && styles.expiryLabelAmber,
                                expiry.tone === 'red' && styles.expiryLabelRed,
                              ]}
                            >
                              {expiry.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {statusBadge(lic.status)}
                    </View>
                  );
                })
              )}

              {card.certifications.length > 0 ? (
                <View>
                  <Text style={styles.sectionLabel}>Certifications</Text>
                  {card.certifications.map((c, i) => (
                    <View key={c.id} style={[styles.licenseRow, i > 0 && styles.rowBorder]}>
                      <View style={styles.licenseText}>
                        <Text style={typography.bodyBold}>{c.name}</Text>
                        {c.certificationNumber ? (
                          <Text style={styles.licenseMeta}>#{c.certificationNumber}</Text>
                        ) : null}
                      </View>
                      {c.isVerified ? <VerifiedBadge size="mini" /> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {card.vouches > 0 ? (
                <Text style={styles.vouchLine}>
                  {card.vouches} {card.vouches === 1 ? 'vouch' : 'vouches'} from people they've
                  worked with
                </Text>
              ) : null}
            </View>
          </View>

          {card.slug ? (
            <Button label="Share my card" onPress={onShare} style={styles.shareBtn} />
          ) : null}
          {card.slug ? (
            <View style={styles.shareHintRow}>
              <Share2 color={colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.shareHint}>
                Anyone with the link can see your card — no app needed.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...typography.h3, flex: 1, textAlign: 'center', color: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.danger },
  content: { padding: spacing.lg },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  band: {
    // Brand gradient anchor (#B0C4DE→#4682B4) — solid steel since
    // expo-linear-gradient isn't a dependency.
    backgroundColor: colors.steel,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 18, fontWeight: '700', color: colors.navy },
  bandText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { ...typography.h2, color: colors.textInverse },
  bandLocation: { ...typography.small, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  body: { padding: spacing.lg },
  tradeLine: { ...typography.bodyBold, color: colors.navy },
  unionRow: { flexDirection: 'row', marginTop: spacing.sm },
  sectionLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptyLicenses: { paddingVertical: spacing.xs },
  emptyText: { ...typography.body, color: colors.textMuted },
  addLicenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  addLicenseLabel: { ...typography.bodyBold, color: colors.navy, flex: 1 },
  licenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  licenseText: { flex: 1 },
  licenseMeta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  expiryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  expiryAmber: { backgroundColor: colors.amber },
  expiryRed: { backgroundColor: colors.red },
  expiryLabel: { ...typography.small, fontWeight: '600', color: colors.textMuted },
  expiryLabelAmber: { color: colors.amberText },
  expiryLabelRed: { color: colors.textInverse },
  vouchLine: {
    ...typography.small,
    color: colors.textBody,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  shareBtn: { marginTop: spacing.lg },
  shareHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  shareHint: { ...typography.small, color: colors.textMuted },
});
