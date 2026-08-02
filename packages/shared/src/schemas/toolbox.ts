import { z } from 'zod';

// ── Toolbox Talk (E2) ─────────────────────────────────────────
export const toolboxAnswerSchema = z.object({
  choiceIndex: z.number().int().min(0).max(9),
});
export type ToolboxAnswerInput = z.infer<typeof toolboxAnswerSchema>;
