-- Split coauthor_invite notifications off the shared notify_mentions pref —
-- a worker who muted @-mention spam was also losing real crew-post coauthor
-- invites with no fallback signal (sim findings, confirmed 4 straight weeks).
-- Default true so nobody's existing behavior changes until they opt out.
ALTER TABLE "user_settings" ADD COLUMN "notify_coauthor_invites" BOOLEAN NOT NULL DEFAULT true;
