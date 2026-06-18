import { Stack } from 'expo-router';
import { usePushNotifications } from '../../src/hooks/usePushNotifications.js';

// (app) is a Stack so we can:
//   1. mount the (tabs) navigator as the default destination, and
//   2. push full-screen flows (profile creation wizard, public profile)
//      ON TOP of the tabs without the tab bar.
export default function AppLayout() {
  // Register for push notifications on mount (once per app launch).
  usePushNotifications();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile-create-photo" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="post-job" />
      <Stack.Screen name="applications/[jobId]" />
      <Stack.Screen name="verifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notification-settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="new-chat/[userId]" />
      <Stack.Screen name="verify-phone" />
    </Stack>
  );
}
