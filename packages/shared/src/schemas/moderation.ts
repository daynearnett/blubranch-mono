import { z } from 'zod';

// ── Content reports (user → moderation queue) ─────────────────────
export const reportTargetTypeSchema = z.enum(['post', 'comment', 'user', 'message']);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const reportReasonSchema = z.enum([
  'spam',
  'harassment',
  'explicit',
  'scam',
  'hate',
  'violence',
  'other',
]);
export type ReportReason = z.infer<typeof reportReasonSchema>;

// Human labels for the mobile report sheet.
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  explicit: 'Nudity or sexual content',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  violence: 'Violence or threats',
  scam: 'Scam or fraud',
  spam: 'Spam',
  other: 'Something else',
};

export const reportInputSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().min(1).max(64),
  reason: reportReasonSchema,
  details: z.string().max(2000).optional(),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

// Admin resolution of a report.
export const reportResolveSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  resolutionNote: z.string().max(2000).optional(),
  // When true, also archive the offending post (only for post targets).
  archiveTarget: z.boolean().optional(),
});
export type ReportResolveInput = z.infer<typeof reportResolveSchema>;

// ── In-app bug reports (user → admin issue queue) ─────────────────
export const issueInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  screenshotUrl: z.string().url().max(500).optional(),
  appVersion: z.string().max(50).optional(),
  platform: z.string().max(20).optional(),
  deviceInfo: z.string().max(200).optional(),
});
export type IssueInput = z.infer<typeof issueInputSchema>;

export const issueUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;
