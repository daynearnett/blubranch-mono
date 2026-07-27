-- Password reset: per-user token version. Refresh JWTs embed this value; a
-- password reset bumps it, invalidating every previously-issued refresh token.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
