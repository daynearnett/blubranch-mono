import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/lib/auth-context.js';
import { me } from '../src/lib/api.js';
import { colors } from '../src/theme.js';

/**
 * Entry redirect.
 *
 * Signed-in users with an unfinished profile are sent back into onboarding
 * rather than dropped on the feed. Two ways to end up in that state:
 *
 *   1. Abandoning signup partway. The account is created at the end of the
 *      email step (so the rest of the wizard runs authenticated), so a
 *      worker who quits at the location step has an account and no profile.
 *   2. Social sign-in, which provisions an empty worker profile. This was
 *      already true before the registration move — social-auth-buttons.tsx
 *      claimed the root layout routed on profile state, and it didn't.
 *
 * "Unfinished" here is deliberately narrower than the Quick Apply readiness
 * gate: only the two things onboarding itself collects (a trade and a
 * location). Everything else is the gate's job, so we don't trap someone in
 * a wizard over a missing profile photo.
 */
export default function Index() {
  const { status } = useAuth();
  const [resume, setResume] = useState<'pending' | 'onboarding' | 'app'>('pending');

  useEffect(() => {
    if (status !== 'signed-in') return;
    let active = true;
    me.get()
      .then((data) => {
        if (!active) return;
        const wp = data.workerProfile;
        const needsOnboarding =
          data.role === 'worker' && (data.trades.length === 0 || !wp?.city || !wp?.state);
        setResume(needsOnboarding ? 'onboarding' : 'app');
      })
      // Offline or a failing API shouldn't strand anyone on a spinner —
      // let them into the app and leave it to the readiness gate.
      .catch(() => active && setResume('app'));
    return () => {
      active = false;
    };
  }, [status]);

  if (status === 'loading' || (status === 'signed-in' && resume === 'pending')) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (status !== 'signed-in') return <Redirect href="/(auth)/welcome" />;
  return (
    <Redirect href={resume === 'onboarding' ? '/(auth)/signup-location' : '/(app)/(tabs)/feed'} />
  );
}
