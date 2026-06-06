import { z } from 'zod';

// ── Send message ────────────────────────────────────────────────────
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ── Start conversation (by recipient ID) ────────────────────────────
export const startConversationSchema = z.object({
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;

// ── Conversation list query ─────────────────────────────────────────
export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;

// ── Message thread query (cursor-based pagination) ──────────────────
export const messageThreadQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type MessageThreadQuery = z.infer<typeof messageThreadQuerySchema>;
