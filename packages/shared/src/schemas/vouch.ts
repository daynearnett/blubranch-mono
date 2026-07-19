import { z } from 'zod';

// ── "Worked together" vouch ───────────────────────────────────
// A vouch is a claim + confirmation (mutual attestation). The company/year
// context is optional free text — suggested shared workplaces pre-fill it,
// but a voucher can type the job/site when the data doesn't line up.
export const vouchInputSchema = z.object({
  companyName: z.string().min(1).max(200).optional().nullable(),
  startYear: z
    .string()
    .regex(/^\d{4}$/, 'Use a 4-digit year')
    .optional()
    .nullable(),
  endYear: z
    .string()
    .regex(/^\d{4}$/, 'Use a 4-digit year')
    .optional()
    .nullable(),
});
export type VouchInput = z.infer<typeof vouchInputSchema>;
