import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { TRADE_LIST } from '@blubranch/shared';
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

// MM/YYYY — e.g. 06/2021. Optional, so an empty field is always fine.
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\/\d{4}$/;

// MM/YYYY → comparable ordinal (year*12 + month) for future / order checks.
function monthOrdinal(mmYYYY: string): number {
  const [mm = 0, yyyy = 0] = mmYYYY.split('/').map(Number);
  return yyyy * 12 + mm;
}
function currentOrdinal(): number {
  const now = new Date();
  return now.getFullYear() * 12 + (now.getMonth() + 1);
}

export default function SignupTrade() {
  const router = useRouter();
  const { draft, update, reset } = useSignup();
  const { register } = useAuth();
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);
  const [endErr, setEndErr] = useState<string | null>(null);

  useEffect(() => {
    reference
      .trades()
      .then((data) => setTrades(data as TradeOption[]))
      .catch(() => {
        setTrades(TRADE_LIST.map((t, i) => ({ ...t, id: -1 - i })));
      });
  }, []);

  // Show the popular trades upfront. If the seed data doesn't flag any as
  // popular, fall back to the first 8 so the picker is never empty.
  const popular = trades.filter((t) => t.isPopular);
  const primaryTrades = popular.length > 0 ? popular : trades.slice(0, 8);
  const visibleTrades = showAll ? trades : primaryTrades;

  const toggleTrade = (id: number) => {
    update({
      tradeIds: draft.tradeIds.includes(id)
        ? draft.tradeIds.filter((t) => t !== id)
        : [...draft.tradeIds, id],
    });
  };

  const canSubmit =
    draft.tradeIds.length > 0 &&
    draft.currentCompany.trim() !== '' &&
    draft.currentTitle.trim() !== '';

  const onCreate = async () => {
    if (!canSubmit) return;

    // Dates are optional; only validate format when present so a typo shows an
    // inline hint instead of failing signup at the server.
    const start = draft.currentStartDate.trim();
    const end = draft.currentEndDate.trim();
    let badDate = false;
    if (start) {
      if (!MONTH_YEAR.test(start)) {
        setStartErr('Use MM/YYYY');
        badDate = true;
      } else if (monthOrdinal(start) > currentOrdinal()) {
        setStartErr("Can't be in the future");
        badDate = true;
      }
    }
    if (end) {
      if (!MONTH_YEAR.test(end)) {
        setEndErr('Use MM/YYYY');
        badDate = true;
      } else if (monthOrdinal(end) > currentOrdinal()) {
        setEndErr("Can't be in the future");
        badDate = true;
      } else if (start && MONTH_YEAR.test(start) && monthOrdinal(end) < monthOrdinal(start)) {
        setEndErr('End is before start');
        badDate = true;
      }
    }
    if (badDate) return;

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

      const positiveTradeIds = draft.tradeIds.filter((id) => id > 0);
      if (positiveTradeIds.length) {
        await me.setTrades({ tradeIds: positiveTradeIds }).catch(() => undefined);
      }
      // experienceLevel + travelRadiusMiles are no longer asked in onboarding —
      // the server fills sensible defaults; both move to account settings later.
      await me.updateWorkerProfile({
        city: draft.city,
        state: draft.state,
        zipCode: draft.zipCode,
        jobAvailability: draft.jobAvailability,
        currentCompany: draft.currentCompany.trim(),
        currentTitle: draft.currentTitle.trim(),
        currentStartDate: start || null,
        currentEndDate: end || null,
      });

      reset();
      router.replace('/(app)/profile-create-photo');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message && err.message !== 'ValidationError'
          ? err.message
          : 'Something went wrong creating your profile. Please try again.';
      Alert.alert('Signup failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupShell progress={85}>
      <View>
        <Text style={styles.title}>What's your trade?</Text>
        <Text style={styles.subtitle}>Pick all that apply.</Text>

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

        {trades.length > primaryTrades.length && (
          <Pressable style={styles.viewMoreBtn} onPress={() => setShowAll(!showAll)}>
            {showAll ? (
              <ChevronUp color={colors.orange} size={18} strokeWidth={2} />
            ) : (
              <ChevronDown color={colors.orange} size={18} strokeWidth={2} />
            )}
            <Text style={styles.viewMoreText}>
              {showAll ? 'Show fewer' : `View all ${trades.length} trades`}
            </Text>
          </Pressable>
        )}

        <Input
          label="Current company"
          placeholder="e.g. Turner Construction"
          value={draft.currentCompany}
          onChangeText={(v) => update({ currentCompany: v })}
        />
        <Input
          label="Job title"
          placeholder="e.g. Journeyman Electrician"
          value={draft.currentTitle}
          onChangeText={(v) => update({ currentTitle: v })}
        />
        <View style={styles.dateRow}>
          <Input
            containerStyle={styles.dateField}
            label="Start (MM/YYYY)"
            placeholder="06/2021"
            value={draft.currentStartDate}
            onChangeText={(v) => {
              update({ currentStartDate: v });
              if (startErr) setStartErr(null);
            }}
            error={startErr ?? undefined}
            keyboardType="numbers-and-punctuation"
          />
          <Input
            containerStyle={styles.dateField}
            label="End (MM/YYYY)"
            placeholder="Now"
            value={draft.currentEndDate}
            onChangeText={(v) => {
              update({ currentEndDate: v });
              if (endErr) setEndErr(null);
            }}
            error={endErr ?? undefined}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <Button
        variant="ctaDark"
        label="Create my BluBranch profile"
        disabled={!canSubmit}
        onPress={onCreate}
        loading={submitting}
        style={{ marginTop: spacing.lg }}
      />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  viewMoreText: { ...typography.bodyBold, color: colors.orange },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateField: { flex: 1 },
});
