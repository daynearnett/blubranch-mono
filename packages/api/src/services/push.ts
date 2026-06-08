import { getPrisma } from '../lib/prisma.js';
import { getMessaging } from './firebase.js';
import type { NotificationType } from '../../../db/src/generated/client/index.js';

/**
 * Create an in-app notification record and send a push notification
 * to the user's registered devices via FCM.
 *
 * Respects per-type notification preferences in UserSettings.
 * Degrades gracefully: if Firebase isn't configured or devices aren't
 * registered, only the in-app notification is created.
 */
export async function sendNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const prisma = getPrisma();

  // Check notification preferences.
  const settings = await prisma.userSettings.findUnique({
    where: { userId: params.userId },
  });

  if (settings) {
    const prefMap: Record<string, boolean | undefined> = {
      new_message: settings.notifyMessages,
      connection_request: settings.notifyConnectionRequests,
      connection_accepted: settings.notifyConnectionRequests,
      application_status: settings.notifyApplicationStatus,
      job_match: settings.notifyJobMatch,
      profile_view: settings.notifyProfileViews,
      profile_nudge: settings.notifyProfileNudges,
    };
    if (prefMap[params.type] === false) {
      return;
    }
  }

  // Persist the in-app notification.
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ? (params.data as Record<string, string>) : undefined,
    },
  });

  // Send FCM push to registered devices.
  const devices = await prisma.deviceToken.findMany({
    where: { userId: params.userId },
    select: { token: true, platform: true },
  });

  if (devices.length === 0) return;

  const messaging = getMessaging();
  if (!messaging) {
    console.log(
      `[Push] Firebase not configured — skipping FCM for ${devices.length} device(s)`,
    );
    return;
  }

  const tokens = devices.map((d) => d.token);
  const dataPayload: Record<string, string> = {
    type: params.type,
    ...(params.data
      ? Object.fromEntries(
          Object.entries(params.data).map(([k, v]) => [k, String(v)]),
        )
      : {}),
  };

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: dataPayload,
      // iOS-specific: badge, sound
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
      // Android-specific: priority
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
    });

    const failed = response.responses.filter((r) => !r.success);
    if (failed.length > 0) {
      console.warn(
        `[Push] ${failed.length}/${tokens.length} FCM sends failed`,
      );
      // Remove invalid tokens (token expired, app uninstalled, etc.)
      const invalidTokens: string[] = [];
      response.responses.forEach((r, i) => {
        if (
          !r.success &&
          r.error &&
          (r.error.code === 'messaging/registration-token-not-registered' ||
            r.error.code === 'messaging/invalid-registration-token')
        ) {
          invalidTokens.push(tokens[i]!);
        }
      });
      if (invalidTokens.length > 0) {
        await prisma.deviceToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(
          `[Push] Removed ${invalidTokens.length} invalid device token(s)`,
        );
      }
    }
  } catch (err) {
    console.error('[Push] FCM send failed:', err);
    // Don't throw — push failure shouldn't break the calling flow.
  }
}

/**
 * Notify a user that someone viewed their profile. Throttled to at most one
 * notification per (viewer → viewed) pair per 24h so frequent visitors don't
 * spam the viewed user. Respects the notifyProfileViews preference (via
 * sendNotification). Best-effort — callers should not await/block on it.
 */
export async function notifyProfileView(viewerId: string, viewedId: string): Promise<void> {
  if (!viewerId || !viewedId || viewerId === viewedId) return;
  const prisma = getPrisma();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: {
      userId: viewedId,
      type: 'profile_view',
      createdAt: { gte: since },
      data: { path: ['viewerId'], equals: viewerId },
    },
    select: { id: true },
  });
  if (recent) return; // already notified about this viewer recently

  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { firstName: true, lastName: true },
  });
  if (!viewer) return;

  await sendNotification({
    userId: viewedId,
    type: 'profile_view',
    title: 'Someone viewed your profile',
    body: `${viewer.firstName} ${viewer.lastName} viewed your profile`,
    data: { viewerId },
  });
}
