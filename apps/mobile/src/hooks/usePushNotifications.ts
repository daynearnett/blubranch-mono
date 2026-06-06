import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { notifications } from '../lib/api.js';

// Configure how notifications appear when the app is in the foreground.
// FCM does not auto-display data/notification messages while the app is
// foregrounded — we surface them manually via expo-notifications below.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications (Direct FCM, matching the Taist
 * reference architecture) and send the FCM token to the API.
 *
 * Token strategy:
 *   - Uses `@react-native-firebase/messaging` `getToken()` to obtain a
 *     real FCM registration token on BOTH platforms. On iOS the native
 *     Firebase SDK exchanges the APNs token for an FCM token on-device —
 *     this is why we don't use expo-notifications' getDevicePushTokenAsync
 *     (which returns a raw APNs token iOS-side that firebase-admin can't
 *     deliver to).
 *   - `expo-notifications` is used only for foreground display + the
 *     Android notification channel.
 *
 * Requires a dev/production build — the native Firebase module is not
 * present in Expo Go, so this no-ops gracefully there.
 */
export function usePushNotifications() {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeOnMessage: (() => void) | undefined;

    registerForPushNotifications()
      .then((handlers) => {
        unsubscribeTokenRefresh = handlers?.unsubscribeTokenRefresh;
        unsubscribeOnMessage = handlers?.unsubscribeOnMessage;
      })
      .catch((err) => {
        console.warn('[Push] Registration failed:', err);
      });

    return () => {
      unsubscribeTokenRefresh?.();
      unsubscribeOnMessage?.();
    };
  }, []);
}

async function registerForPushNotifications(): Promise<
  { unsubscribeTokenRefresh?: () => void; unsubscribeOnMessage?: () => void } | undefined
> {
  // Push notifications only work on physical devices.
  if (!Device.isDevice) {
    console.log('[Push] Skipping registration — not a physical device');
    return;
  }

  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  // Android: create the notification channel before anything else so
  // foreground notifications have somewhere to land.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E85D20',
    });
  }

  // Request notification permission via the Firebase SDK (covers iOS
  // APNs authorization + Android 13+ POST_NOTIFICATIONS).
  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) {
    console.log('[Push] Permission not granted');
    return;
  }

  // iOS: ensure the device is registered for remote messages so the
  // APNs→FCM token exchange can complete. No-op on Android.
  if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }

  // Get the real FCM registration token and send it to the API.
  const fcmToken = await messaging().getToken();
  if (fcmToken) {
    await notifications.registerDevice(fcmToken, platform);
    console.log(`[Push] Registered FCM token (${platform}): ${fcmToken.slice(0, 20)}...`);
  }

  // Keep the server in sync when the token rotates.
  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken: string) => {
    try {
      await notifications.registerDevice(newToken, platform);
      console.log('[Push] FCM token refreshed and re-registered');
    } catch (err) {
      console.warn('[Push] Token refresh re-register failed:', err);
    }
  });

  // Foreground messages: FCM doesn't display these automatically, so we
  // surface them as a local notification via expo-notifications.
  const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? 'BluBranch';
    const body = remoteMessage.notification?.body ?? '';
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: remoteMessage.data ?? {},
      },
      trigger: null, // show immediately
    });
  });

  return { unsubscribeTokenRefresh, unsubscribeOnMessage };
}
