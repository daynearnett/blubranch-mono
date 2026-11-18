-- Crew-post co-author invites were silently gated behind the generic
-- `notify_mentions` preference. A worker who muted @-mention spam also lost
-- real invites to be tagged as a co-author on someone else's post, with no
-- fallback signal (sim finding, first caught 2026-11-09, reconfirmed every
-- run since). Give it its own preference, defaulting to on, decoupled from
-- mentions.

ALTER TABLE "user_settings" ADD COLUMN "notify_coauthor_invites" BOOLEAN NOT NULL DEFAULT true;
