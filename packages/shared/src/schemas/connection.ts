import { z } from 'zod';

export const connectionRequestSchema = z.object({
  receiverId: z.string().uuid(),
  note: z.string().max(300).optional().nullable(),
});
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;

export const connectionListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  sort: z.enum(['recent', 'first_name', 'last_name', 'trade']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConnectionListQuery = z.infer<typeof connectionListQuerySchema>;
