// Account → Plan & billing. The ONLY place employers change subscription tier
// (the post flow never does). Subscribe / upgrade / downgrade / cancel / resume.
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { ArrowLeft } from 'lucide-react-native';
import { PLAN_LABELS, PLAN_PRICE_CENTS, type SubscriptionStatus } from '@blubranch/shared';
import { Button, Card } from '../../src/components/ui.js';
import { ApiError, payments as paymentsApi } from '../../src/lib/api.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const dollars = (plan: 'pro' | 'unlimited') => `$${(PLAN_PRICE_CENTS[plan] / 100).toFixed(0)}`;

export default function PlanBilling() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    paymentsApi
      .subscriptionStatus()
      .then(setSub)
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async (plan: 'pro' | 'unlimited') => {
    setBusy(true);
    try {
      const params = await paymentsApi.subscriptionIntent(plan);
      const init = await initPaymentSheet({
        merchantDisplayName: 'BluBranch',
        customerId: params.customerId,
        customerEphemeralKeySecret: params.ephemeralKeySecret,
        paymentIntentClientSecret: params.paymentIntentClientSecret,
        returnURL: 'blubranch://stripe-redirect',
      });
      if (init.error) throw new Error(init.error.message);
      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert('Payment failed', error.message);
        return;
      }
      await paymentsApi.confirmSubscription().catch(() => undefined);
      Alert.alert('You’re subscribed', `${PLAN_LABELS[plan]} is now active.`);
      load();
    } catch (err) {
      Alert.alert('Could not subscribe', err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const change = async (plan: 'pro' | 'unlimited', verb: string) => {
    setBusy(true);
    try {
      await paymentsApi.changeSubscription(plan);
      Alert.alert('Plan updated', `You’re now on ${PLAN_LABELS[plan]}.`);
      load();
    } catch (err) {
      Alert.alert(`Could not ${verb}`, err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    Alert.alert('Cancel plan?', 'You keep access until the end of the current period.', [
      { text: 'Keep plan', style: 'cancel' },
      {
        text: 'Cancel plan',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await paymentsApi.cancelSubscription();
            load();
          } catch (err) {
            Alert.alert('Could not cancel', err instanceof ApiError ? err.message : 'Try again');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const active = !!sub?.active;
  const tier = sub?.plan === 'pro' || sub?.plan === 'unlimited' ? sub.plan : null;
  const otherTier = tier === 'pro' ? 'unlimited' : 'pro';
  const renews = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <ArrowLeft color={colors.navy} size={22} strokeWidth={2} />
        </Text>
        <Text style={styles.topBarTitle}>Plan & billing</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current plan</Text>
            <Text style={styles.currentPlan}>{active && tier ? PLAN_LABELS[tier] : 'Basic'}</Text>
            {active && tier ? (
              <Text style={styles.currentSub}>
                {dollars(tier)}/month ·{' '}
                {sub?.cancelAtPeriodEnd
                  ? `Cancels ${renews ?? 'at period end'}`
                  : renews
                    ? `Renews ${renews}`
                    : sub?.status}
              </Text>
            ) : (
              <Text style={styles.currentSub}>Pay $19 per job post — no subscription.</Text>
            )}
          </Card>

          {active && tier ? (
            <>
              {sub?.cancelAtPeriodEnd ? (
                <Button
                  label="Resume plan"
                  loading={busy}
                  onPress={() => change(tier, 'resume')}
                  style={styles.btn}
                />
              ) : (
                <Button
                  variant="ctaDark"
                  label={`Switch to ${PLAN_LABELS[otherTier]} (${dollars(otherTier)}/mo)`}
                  loading={busy}
                  onPress={() =>
                    change(otherTier, otherTier === 'unlimited' ? 'upgrade' : 'downgrade')
                  }
                  style={styles.btn}
                />
              )}
              {!sub?.cancelAtPeriodEnd ? (
                <Button variant="ghost" label="Cancel plan" onPress={cancel} disabled={busy} />
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.upsell}>Subscribe to post unlimited jobs:</Text>
              <Card style={styles.planCard}>
                <Text style={styles.planTitle}>{PLAN_LABELS.pro} · {dollars('pro')}/mo</Text>
                <Text style={styles.planDesc}>Unlimited posts, featured placement, urgent badge, analytics.</Text>
                <Button label={`Subscribe to ${PLAN_LABELS.pro}`} loading={busy} onPress={() => subscribe('pro')} style={styles.btn} />
              </Card>
              <Card style={styles.planCard}>
                <Text style={styles.planTitle}>{PLAN_LABELS.unlimited} · {dollars('unlimited')}/mo</Text>
                <Text style={styles.planDesc}>Everything in Blu + push alerts, direct messaging, priority support.</Text>
                <Button variant="ctaDark" label={`Subscribe to ${PLAN_LABELS.unlimited}`} loading={busy} onPress={() => subscribe('unlimited')} style={styles.btn} />
              </Card>
            </>
          )}
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  back: { width: 36, height: 36, textAlignVertical: 'center' },
  topBarTitle: { ...typography.h3, color: colors.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg },
  currentCard: { backgroundColor: colors.background, borderRadius: radius.md, marginBottom: spacing.lg },
  currentLabel: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  currentPlan: { ...typography.h1, color: colors.primaryDark, marginTop: spacing.xs },
  currentSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  upsell: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  planCard: { backgroundColor: colors.background, borderRadius: radius.md, marginBottom: spacing.md },
  planTitle: { ...typography.h3, color: colors.primaryDark, marginBottom: spacing.xs },
  planDesc: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },
  btn: { marginTop: spacing.sm },
});
