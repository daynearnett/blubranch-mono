// Mockup screen 2C — Sign up step 3 of 3: Location
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JOB_AVAILABILITY_OPTIONS, TRAVEL_RADIUS_OPTIONS } from '@blubranch/shared';
import type { JobAvailability } from '@blubranch/shared';
import { Button, Chip, Input, ProgressDots } from '../../src/components/ui.js';
import { ApiError, me } from '../../src/lib/api.js';
import { useAuth } from '../../src/lib/auth-context.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function SignupLocation() {
  const router = useRouter();
  const { draft, reset } = useSignup();
  const { register } = useAuth();
  const [city, setCity] = useState(draft.city);
  const [state, setState] = useState(draft.state);
  const [zip, setZip] = useState(draft.zipCode);
  const [radius_, setRadius] = useState<number>(draft.travelRadiusMiles);
  const [availability, setAvailability] = useState<JobAvailability>(draft.jobAvailability);
  const [submitting, setSubmitting] = useState(false);

  const onCreate = async () => {
    if (!city.trim() || !state.trim() || !zip.trim()) {
      Alert.alert('Almost there', 'City, state, and zip code are required.');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Register the user (returns JWTs + creates worker profile stub).
      await register({
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone,
        password: draft.password,
        role: draft.role,
      });

      // 2. If worker, persist the trade selections + location.
      if (draft.role === 'worker') {
        // Trade IDs only valid if loaded from API. Negative ids = offline fallback.
        const positiveTradeIds = draft.tradeIds.filter((id) => id > 0);
        if (positiveTradeIds.length) {
          await me.setTrades({ tradeIds: positiveTradeIds }).catch(() => undefined);
        }
        await me.updateWorkerProfile({
          experienceLevel: draft.experienceLevel ?? undefined,
          city,
          state,
          zipCode: zip,
          travelRadiusMiles: radius_,
          jobAvailability: availability,
          unionName: draft.unionName || null,
          // Self-reported license # lives on the worker profile.
          // The certifications table is reserved for named, verifiable credentials.
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <ProgressDots count={3} current={2} />
          <Text style={styles.title}>Where do you work?</Text>
          <Text style={styles.subtitle}>Step 3 of 3</Text>

          <Input label="City" value={city} onChangeText={setCity} />
          <Input label="State" value={state} onChangeText={setState} autoCapitalize="characters" />
          <Input
            label="Zip code"
            value={zip}
            onChangeText={setZip}
            keyboardType="number-pad"
            maxLength={10}
          />

          <Text style={styles.fieldLabel}>How far will you travel for work?</Text>
          <View style={styles.chipWrap}>
            {TRAVEL_RADIUS_OPTIONS.map((mi) => (
              <Chip
                key={mi}
                label={`Within ${mi} miles`}
                active={radius_ === mi}
                onPress={() => setRadius(mi)}
              />
            ))}
          </View>

          <View style={styles.privacyCallout}>
            <Text style={styles.privacyText}>
              Your location is only shown as a city/region on your profile — never your exact
              address. You control your privacy.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Job availability</Text>
          <View style={styles.chipWrap}>
            {JOB_AVAILABILITY_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={availability === opt.value}
                onPress={() => setAvailability(opt.value as JobAvailability)}
              />
            ))}
          </View>
        </View>

        <View>
          <Button
            variant="ctaDark"
            label="Create my BluBranch profile"
            onPress={onCreate}
            loading={submitting}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={styles.helper}>Takes about 30 seconds to finish your profile</Text>
        </View>
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
  privacyCallout: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  privacyText: { ...typography.caption, color: colors.textSecondary },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
