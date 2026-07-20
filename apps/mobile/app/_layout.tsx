import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from '../src/lib/auth-context.js';
import { initSentry, withSentry } from '../src/lib/sentry.js';
import { DetailPanelProvider } from '../src/lib/detail-panel-context.js';
import { PostJobProvider } from '../src/lib/post-job-context.js';
import { SignupProvider } from '../src/lib/signup-context.js';
import { AnimatedLogo, LOGO_ANIMATION_MS } from '../src/components/animated-logo.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

// Keep the native splash up until the auth bootstrap resolves so the user
// never sees a flash of empty white between launch and the first screen.
// Wrapped in try/catch because preventAutoHideAsync rejects on web and on
// rare iOS conditions — failing to prevent the splash should never crash
// the entire app.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Initialize error monitoring before the tree mounts (no-op without a DSN).
initSentry();

function RootGuard() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Hide the splash as soon as we know which side of the auth boundary the
  // user belongs on. By that point RootGuard's <Stack> has already mounted
  // its first screen so the transition is instant.
  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signed-out' && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (status === 'signed-in' && inAuthGroup) {
      router.replace('/(app)/(tabs)/feed');
    }
  }, [status, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

// Branded splash overlay — the mark draws itself in over the (blank white)
// native splash: lower "b" first, then the upper "b" grows off the same stem,
// then the twig. Slogan fades in as the mark completes; the whole overlay
// fades into the app.
const SPLASH_HOLD_AFTER_LOGO_MS = 700;

function BrandSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sloganOpacity, {
      toValue: 1,
      duration: 450,
      delay: LOGO_ANIMATION_MS - 350,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) onDone();
        },
      );
    }, LOGO_ANIMATION_MS + SPLASH_HOLD_AFTER_LOGO_MS);
    return () => clearTimeout(t);
  }, [opacity, sloganOpacity, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, brandStyles.container, { opacity }]}
    >
      <AnimatedLogo size={150} />
      <Animated.Text style={[brandStyles.slogan, { opacity: sloganOpacity }]}>
        Networking for the Blue Collar
      </Animated.Text>
    </Animated.View>
  );
}

const brandStyles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 20 },
  slogan: { color: '#3D5A80', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});

// Wrap the tree in Stripe's provider on native so the Payment Sheet can mount.
// Web export skips it (Payment Sheet is native-only) to keep the bundle clean.
function PaymentProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier="merchant.com.blubranch.app"
    >
      <>{children}</>
    </StripeProvider>
  );
}

function RootLayout() {
  const [brandDone, setBrandDone] = useState(false);
  return (
    <SafeAreaProvider>
      <PaymentProvider>
        <AuthProvider>
          <SignupProvider>
            <PostJobProvider>
              <DetailPanelProvider>
                <StatusBar style="dark" />
                <RootGuard />
              </DetailPanelProvider>
            </PostJobProvider>
          </SignupProvider>
        </AuthProvider>
      </PaymentProvider>
      {brandDone ? null : <BrandSplash onDone={() => setBrandDone(true)} />}
    </SafeAreaProvider>
  );
}

// withSentry wraps the root for native crash + error-boundary capture (no-op
// unless EXPO_PUBLIC_SENTRY_DSN is set).
export default withSentry(RootLayout);

// Fallback UI rendered by expo-router when a render error escapes the tree.
// Keeps the user on a real screen they can read, even if the app's first
// route never mounts. The retry callback re-runs the failing tree.
function FallbackUI({ error, retry }: { error: Error; retry: () => void }) {
  // Make sure the splash doesn't stay up if the crash happened before
  // RootGuard mounted.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={fallbackStyles.root}>
        <Text style={fallbackStyles.brand}>BluBranch</Text>
        <Text style={fallbackStyles.title}>Something went wrong</Text>
        <Text style={fallbackStyles.body}>
          The app hit an unexpected error while starting up. Tap below to try again. If this keeps
          happening, force-quit and reopen.
        </Text>
        {__DEV__ ? <Text style={fallbackStyles.detail}>{String(error?.message ?? error)}</Text> : null}
        <Pressable style={fallbackStyles.button} onPress={retry}>
          <Text style={fallbackStyles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaProvider>
  );
}

// Re-export so the named export above wins. expo-router picks up the
// component called `ErrorBoundary` from this module.
export { FallbackUI as ErrorBoundary };

const fallbackStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: {
    ...typography.h2,
    // On the dark error screen (primaryDark bg) the brand must stay light.
    color: colors.textInverse,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textInverse,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textInverse,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: spacing.xl,
    maxWidth: 360,
  },
  detail: {
    ...typography.caption,
    color: colors.textInverse,
    opacity: 0.6,
    fontFamily: 'Courier',
    marginBottom: spacing.lg,
    maxWidth: 360,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonLabel: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
});
