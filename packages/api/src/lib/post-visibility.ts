import type { PrismaClient } from '@blubranch/db';

/** The minimal post fields needed to decide who may view it. */
export interface PostVisibilityFields {
  userId: string; // author
  audience: 'anyone' | 'connections';
  archived: boolean;
}

/**
 * Whether `viewerId` (null = anonymous / public request) may view `post`.
 *
 * - The author always sees their own post.
 * - Archived posts are hidden from everyone but the author.
 * - `anyone` posts are public.
 * - `connections` posts require the viewer to be an accepted connection of the
 *   author (anonymous viewers cannot see them).
 */
export async function canViewPost(
  prisma: PrismaClient,
  viewerId: string | null,
  post: PostVisibilityFields,
): Promise<boolean> {
  if (viewerId && viewerId === post.userId) return true;
  if (post.archived) return false;
  if (post.audience === 'anyone') return true;
  if (!viewerId) return false;

  const conn = await prisma.connection.findFirst({
    where: {
      status: 'accepted',
      OR: [
        { requesterId: viewerId, receiverId: post.userId },
        { requesterId: post.userId, receiverId: viewerId },
      ],
    },
    select: { id: true },
  });
  return conn !== null;
}
