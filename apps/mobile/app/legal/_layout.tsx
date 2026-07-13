import { Stack } from 'expo-router';
import { colors } from '../../src/theme.js';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: colors.navy,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.navy },
      }}
    >
      <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
    </Stack>
  );
}
