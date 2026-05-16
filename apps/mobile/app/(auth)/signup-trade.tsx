import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { EXPERIENCE_LEVEL_OPTIONS, TRADE_LIST } from '@blubranch/shared';
import type { ExperienceLevel } from '@blubranch/shared';
import { Button, Chip, Input } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { ApiError, me, reference } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { colors, spacing, typography } from '../../src/theme.js';

interface TradeOption {
  id: number;
  name: string;
  slug: string;
  isPopular?: boolean;
}

export default function SignupTrade() {
  const router = useRouter();
  const { draft, update, reset } = useSignup();
  const { register } = useAuth();
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    reference
      .trades()
      .then((data) => setTrades(data as TradeOption[]))
      .catch(() => {
        setTrades(TRADE_LIST.map((t, i) => ({ ...t, id: -1 - i })));
      });
  }, []);

  const popularTrades = trades.filter((t) => t.isPopular !== false);
  const visibleTrades = showAll ? trades : popularTrades;

  const toggleTrade = (id: number) => {
    update({
      tradeIds: draft.tradeIds.includes(id)
        ? draft.tradeIds.filter((t) => t !== id)
        : [...draft.tradeIds, id],
    });
  };

  const onCreate = async () => {
    if (draft.tradeIds.length === 0 || !draft.experienceLevel) return;

    setSubmitting(true);
    try {
      await register({
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        password: draft.password,
        role: draft.role,
        termsAccepted: draft.termsAccepted,
      });

      if (draft.role === 'worker') {
        const positiveTradeIds = draft.tradeIds.filter((id) => id > 0);
        if (positiveTradeIds.length) {
          await me.setTrades({ tradeIds: positiveTradeIds }).catch(() => undefined);
        }
        await me.updateWorkerProfile({
          experienceLevel: draft.experienceLevel ?? undefined,
          city: draft.city,
          state: draft.state,
          zipCode: draft.zipCode,
          travelRadiusMiles: draft.travelRadiusMiles,
          jobAvailability: draft.jobAvailability,
          unionName: draft.unionName || null,
          licenseNumber: draft.certificationNumber.trim() || null,
        });
      }

      reset();
      router.replace('/(app)/profile-create-photo');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create account';
      Alert.alert('Signup failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupShell progress={85}>
      <View>
        <Text style={styles.title}>What's your trade?</Text>
        <Text style={styles.subtitle}>Pick all that apply — you can change this later.</Text>

        <View style={styles.chipWrap}>
          {visibleTrades.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              active={draft.tradeIds.includes(t.id)}
              onPress={() => toggleTrade(t.id)}
            />
          ))}
        </View>

        {trades.length > popularTrades.length && (
          <Pressable
            style={styles.viewMoreBtn}
            onPress={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <ChevronUp color={colors.orange} size={18} strokeWidth={2} />
            ) : (
              <ChevronDown color={colors.orange} size={18} strokeWidth={2} />
            )}
            <Text style={styles.viewMoreText}>
              {showAll ? 'Show fewer trades' : `View all ${trades.length} trades`}
            </Text>
          </Pressable>
        )}

        <Text style={styles.fieldLabel}>Years of experience</Text>
        <View style={styles.chipWrap}>
          {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={draft.experienceLevel === opt.value}
              onPress={() => update({ experienceLevel: opt.value as ExperienceLevel })}
            />
          ))}
        </View>

        <Input
          label="Current company (optional)"
          placeholder="e.g. Turner Construction"
          value={draft.currentCompany}
          onChangeText={(v) => update({ currentCompany: v })}
        />
        <Input
          label="Job title (optional)"
          placeholder="e.g. Journeyman Electrician"
          value={draft.currentTitle}
          onChangeText={(v) => update({ currentTitle: v })}
        />
        <Input
          label="License / certification # (optional)"
          value={draft.certificationNumber}
          onChangeText={(v) => update({ certificationNumber: v })}
          helper="Verified licenses display a badge on your profile"
        />
        <Input
          label="Union member? (optional)"
          placeholder="e.g. IBEW Local 134"
          value={draft.unionName}
          onChangeText={(v) => update({ unionName: v })}
        />
      </View>

      <Button
        variant="ctaDark"
        label="Create my BluBranch profile"
        disabled={draft.tradeIds.length === 0 || !draft.experienceLevel}
        onPress={onCreate}
        loading={submitting}
        style={{ marginTop: spacing.lg }}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  fieldLabel: {
    ...typography.small,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  viewMoreText: { ...typography.bodyBold, color: colors.orange },
});
