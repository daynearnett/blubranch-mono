import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  tab: z.enum(['people', 'jobs', 'companies', 'posts']).default('jobs'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Filters (blue-collar facets). Booleans arrive as the string 'true'.
  jobType: z.string().max(50).optional(), // Jobs: full_time | part_time | contract | temporary
  payMin: z.coerce.number().int().min(0).max(999999).optional(), // Jobs: min hourly
  openToWork: z.string().optional(), // People: 'true' → open / actively looking
  union: z.string().optional(), // People: 'true' → has a union affiliation
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
