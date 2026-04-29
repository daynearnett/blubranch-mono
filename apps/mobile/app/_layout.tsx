import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth-context.js';
import { DetailPanelProvider } from '../src/lib/detail-panel-context.js';
import { PostJobProvider } from '../src/lib/post-job-context.js';
import { SignupProvider } from '../src/lib/signup-context.js';

function RootGuard() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
