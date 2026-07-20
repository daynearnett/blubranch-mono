import { z } from 'zod';

export const postInputSchema = z.object({
  content: z.string().min(1).max(3000),
  photoUrls: z.array(z.string().url().max(500)).max(5).optional(),
  audience: z.enum(['anyone', 'connections']).default('anyone'),
  locationTag: z.string().max(100).optional().nullable(),
  tradeTag: z.string().max(100).optional().nullable(),
  // Tagged connections — notified when the post/comment is created.
  mentionedUserIds: z.array(z.string().uuid()).max(10).optional(),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const postCommentInputSchema = z.object({
  content: z.string().min(1).max(2000),
  mentionedUserIds: z.array(z.string().uuid()).max(10).optional(),
});
export type PostCommentInput = z.infer<typeof postCommentInputSchema>;

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;
