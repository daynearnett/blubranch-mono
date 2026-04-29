import { Stack } from 'expo-router';

// (app) is a Stack so we can:
//   1. mount the (tabs) navigator as the default destination, and
//   2. push full-screen flows (profile creation wizard, public profile)
//      ON TOP of the tabs without the tab bar.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile-create-photo" />
      <Stack.Screen name="profile-create-skills" />
      <Stack.Screen name="profile-create-photos" />
      <Stack.Screen name="profile-create-privacy" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="post-job" />
      <Stack.Screen name="applications/[jobId]" />
    </Stack>
  );
}
