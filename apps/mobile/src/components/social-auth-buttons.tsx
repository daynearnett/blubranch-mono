import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context.js';
import { ApiError } from '../lib/api.js';
import { colors, radius, spacing, typography } from '../theme.js';

// Google OAuth client ids — supplied at build time. The web client id is the
// `serverClientId`, which becomes the id_token `aud` the API verifies against.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured || !GOOGLE_WEB_CLIENT_ID) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
}

interface Props {
  // Where to land after a successful sign-in. New social users skip the signup
  // wizard; the root layout routes them to onboarding/feed based on profile state.
  onDone?: () => void;
  role?: 'worker' | 'employer';
}

export function SocialAuthButtons({ onDone, role = 'worker' }: Props) {
  const { signInWithSocial } = useAuth();
  const router = useRouter();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureGoogle();
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  const finish = useCallback(() => {
    if (onDone) onDone();
    else router.replace('/');
  }, [onDone, router]);

  const handleApple = useCallback(async () => {
    setError(null);
    setBusy('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }
      await signInWithSocial({
        provider: 'apple',
        idToken: credential.identityToken,
        role,
        // Apple only sends the name on the FIRST authorization — captured here
        // for the display name, never trusted for identity by the server.
        firstName: credential.fullName?.givenName ?? undefined,
        lastName: credential.fullName?.familyName ?? undefined,
      });
      finish();
    } catch (err: unknown) {
      // User-cancelled is not an error worth surfacing.
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return;
      setError(messageFor(err, 'Apple sign-in failed. Please try again.'));
    } finally {
      setBusy(null);
    }
  }, [finish, role, signInWithSocial]);

  const handleGoogle = useCallback(async () => {
    setError(null);
    if (!GOOGLE_WEB_CLIENT_ID) {
      setError('Google sign-in is not configured on this build.');
      return;
    }
    setBusy('google');
    try {
      configureGoogle();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      // v13+ returns { type, data }; older returns the user object directly.
      const idToken =
        (result as { data?: { idToken?: string } }).data?.idToken ??
        (result as { idToken?: string }).idToken ??
        null;
      if (!idToken) {
        // type === 'cancelled' has no idToken — treat as a silent cancel.
        if ((result as { type?: string }).type === 'cancelled') return;
        throw new Error('Google did not return an ID token.');
      }
      await signInWithSocial({ provider: 'google', idToken, role });
      finish();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) return;
      setError(messageFor(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setBusy(null);
    }
  }, [finish, role, signInWithSocial]);

  const showApple = Platform.OS === 'ios' && appleAvailable;
  // Google is only shown once its OAuth client id is configured at build time.
  // Until then (e.g. Apple-only launch) the button stays hidden rather than
  // rendering a non-functional control.
  const showGoogle = GOOGLE_WEB_CLIENT_ID.length > 0;
  // No providers to offer (e.g. Android before Google is set up) — render
  // nothing so there's no dangling "or" divider.
  if (!showApple && !showGoogle) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      {showApple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={radius.md}
          style={styles.appleButton}
          onPress={handleApple}
        />
      )}

      {showGoogle && (
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
          onPress={handleGoogle}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {busy === 'google' ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Text style={styles.googleLabel}>
              <Text style={styles.googleG}>G</Text>  Continue with Google
            </Text>
          )}
        </Pressable>
      )}

      {busy === 'apple' && (
        <ActivityIndicator style={styles.appleSpinner} color={colors.navy} />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    ...typography.small,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  appleButton: { height: 50, width: '100%' },
  appleSpinner: { marginTop: spacing.sm },
  googleButton: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pressed: { opacity: 0.7 },
  googleLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  googleG: { color: '#4285F4', fontWeight: '800', fontSize: 18 },
  error: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
