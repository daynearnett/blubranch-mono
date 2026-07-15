import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { JOB_AVAILABILITY_OPTIONS } from '@blubranch/shared';
import type { JobAvailability } from '@blubranch/shared';
import { Button, Chip, Input } from '../../src/components/ui.js';
import { SignupShell } from '../../src/components/signup-shell.js';
import { useSignup } from '../../src/lib/signup-context.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function SignupLocation() {
  const router = useRouter();
  const { draft, update } = useSignup();
  const [locating, setLocating] = useState(false);

  const requestLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocating(false);
        Alert.alert(
          'Location permission needed',
          'Enable location access to auto-fill your city, or enter it manually below.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        update({
          city: geo.city ?? '',
          state: geo.region ?? '',
          zipCode: geo.postalCode ?? '',
        });
      }
    } catch { /* fallback to manual entry */ } finally {
      setLocating(false);
    }
  };

  const onContinue = () => {
    if (!draft.city.trim() || !draft.state.trim() || !draft.zipCode.trim()) {
      Alert.alert('Almost there', 'City, state, and zip code are required.');
      return;
    }
    router.push('/(auth)/signup-trade');
  };

  return (
    <SignupShell progress={60}>
      <View>
        <Text style={styles.title}>Where do you work?</Text>
        <Text style={styles.subtitle}>We'll use this to show jobs near you.</Text>

        <Pressable style={styles.locationBtn} onPress={requestLocation} disabled={locating}>
          <MapPin color={colors.orange} size={20} strokeWidth={2} />
          <Text style={styles.locationBtnText}>
            {locating ? 'Getting your location...' : 'Use my current location'}
          </Text>
        </Pressable>

        <Input label="City" value={draft.city} onChangeText={(v) => update({ city: v })} />
        <Input
          label="State"
          value={draft.state}
          onChangeText={(v) => update({ state: v })}
          autoCapitalize="characters"
        />
        <Input
          label="Zip code"
          value={draft.zipCode}
          onChangeText={(v) => update({ zipCode: v })}
          keyboardType="number-pad"
          maxLength={10}
        />

        <View style={styles.privacyCallout}>
          <Text style={styles.privacyText}>
            Your location is only shown as a city/region on your profile — never your exact address.
          </Text>
        </View>

        <Text style={styles.fieldLabel}>Job availability</Text>
        <View style={styles.chipWrap}>
          {JOB_AVAILABILITY_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={draft.jobAvailability === opt.value}
              onPress={() => update({ jobAvailability: opt.value as JobAvailability })}
            />
          ))}
        </View>
      </View>

      <Button label="Continue" onPress={onContinue} style={{ marginTop: spacing.lg }} />
    </SignupShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.navy, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: colors.chipBgActive,
    marginBottom: spacing.lg,
  },
  locationBtnText: { ...typography.bodyBold, color: colors.navy },
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
  privacyText: { ...typography.small, color: colors.textMuted },
});
