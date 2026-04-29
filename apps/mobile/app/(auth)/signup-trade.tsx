// Mockup screen 2B — Sign up step 2 of 3: Trade
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXPERIENCE_LEVEL_OPTIONS, TRADE_LIST } from '@blubranch/shared';
import type { ExperienceLevel } from '@blubranch/shared';
import { Button, Chip, Input, ProgressDots } from '../../src/components/ui.js';
import { reference } from '../../src/lib/api.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

interface TradeOption {
  id: number;
  name: string;
  slug: string;
}

export default function SignupTrade() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const [trades, setTrades] = useState<TradeOption[]>([]);

  // Load trades from API; fall back to local TRADE_LIST if offline.
  useEffect(() => {
    reference
      .trades()
      .then(setTrades)
      .catch(() => {
        // Slug-only fallback — IDs unknown, so we tag them sequentially. Real IDs
        // are reconciled when the user completes signup with API connectivity.
        setTrades(TRADE_LIST.map((t, i) => ({ ...t, id: -1 - i })));
      });
  }, []);

  const toggleTrade = (id: number) => {
    update({
      tradeIds: draft.tradeIds.includes(id)
        ? draft.tradeIds.filter((t) => t !== id)
        : [...draft.tradeIds, id],
    });
  };

  const onContinue = () => {
    if (draft.tradeIds.length === 0 || !draft.experienceLevel) return;
    router.push('/(auth)/signup-location');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={3} current={1} />
          <Text style={styles.title}>What's your trade?</Text>
          <Text style={styles.subtitle}>Step 2 of 3 — pick all that apply</Text>

          <View style={styles.chipWrap}>
            {trades.map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                active={draft.tradeIds.includes(t.id)}
                onPress={() => toggleTrade(t.id)}
              />
            ))}
          </View>

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
          label="Continue"
          disabled={draft.tradeIds.length === 0 || !draft.experienceLevel}
          onPress={onContinue}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
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
  fieldLabel: {
    ...typography.small,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  field: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: spacing.md,
  },
});
