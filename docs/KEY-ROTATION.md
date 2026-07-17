# Key rotation runbook — Twilio + Resend

Two secrets were exposed in chat/screenshot history and must be rotated before
widening access:
- **`TWILIO_AUTH_TOKEN`** — the Twilio account Auth Token (shown in a setup screenshot).
- **`RESEND_API_KEY`** — the Resend sending key (`re_…`, pasted in chat).

Both are read by the API at runtime and set on **two** Railway services:
- **prod:** project `blubranch-production` → service **`blubranch-mono`**
- **staging:** project `blubranch-staging` → service **`blubranch`**

> Code references: Twilio → [packages/api/src/auth/twilio.ts](../packages/api/src/auth/twilio.ts)
> (`twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)`), Resend →
> [packages/api/src/services/email.ts](../packages/api/src/services/email.ts)
> (`new Resend(RESEND_API_KEY)`). No code change is needed to rotate — only the env values.

**General mechanics (both providers):**
- Update the Railway variable → Railway redeploys that service. Since `main` is the
  connected branch and is current, the redeploy serves the right code (no stale
  rollback risk).
- Rotate **staging first**, verify, then **prod** — so a mistake never takes down prod.
- Both providers allow the old + new secret to be valid simultaneously, so there is
  **zero downtime**: set the new value everywhere, verify, *then* kill the old one.

---

## A. Resend (`RESEND_API_KEY`) — simplest, do this first

Resend keys are independent tokens; just make a new one and delete the old.

1. **Create the new key.** Resend dashboard → **API Keys** → **Create API Key**.
   - Permission: **Sending access** (restricted — not Full access).
   - Domain: `blubranch.com`.
   - Name it e.g. `blubranch-api-2026-07`. Copy the value (`re_…`) — shown once.
2. **Set it on Railway** (staging then prod):
   - Dashboard: service → **Variables** → edit `RESEND_API_KEY` → paste new value → save (redeploys).
   - Or CLI (logged in as `a.daynearnett@gmail.com`):
     ```bash
     railway variables --set "RESEND_API_KEY=<new_key>" --service blubranch       # staging
     railway variables --set "RESEND_API_KEY=<new_key>" --service blubranch-mono  # prod
     ```
3. **Verify** each service after its redeploy (real send, expects `{"sent":true}` and no `devCode`):
   ```bash
   curl -s -X POST https://api-staging.blubranch.com/auth/send-verification-email \
     -H 'content-type: application/json' -d '{"email":"you@yourdomain.com"}'
   curl -s -X POST https://api.blubranch.com/auth/send-verification-email \
     -H 'content-type: application/json' -d '{"email":"you@yourdomain.com"}'
   ```
   Confirm the email actually arrives (first sends from a domain can land in spam).
4. **Revoke the old key.** Resend → API Keys → delete the previous `re_VhCP…` key.
   Once deleted, its exposure in chat history is harmless.

---

## B. Twilio (`TWILIO_AUTH_TOKEN`) — primary/secondary promote (zero downtime)

The app authenticates with the **account Auth Token**. Twilio supports a *secondary*
auth token that is valid alongside the primary, so you migrate to it, then promote it
(which retires the old, exposed primary).

1. **Generate a secondary token.** Twilio Console → account menu → **Account → Keys &
   Credentials → Auth tokens** (a.k.a. "Auth Token" page) → **Request a secondary token**.
   Both primary and secondary are now valid. Copy the **secondary** value.
2. **Set it on Railway** as `TWILIO_AUTH_TOKEN` (staging then prod):
   ```bash
   railway variables --set "TWILIO_AUTH_TOKEN=<secondary>" --service blubranch       # staging
   railway variables --set "TWILIO_AUTH_TOKEN=<secondary>" --service blubranch-mono  # prod
   ```
   (`TWILIO_ACCOUNT_SID` and `TWILIO_VERIFY_SERVICE_SID` do **not** change.)
3. **Verify** after each redeploy. Twilio is still on **trial**, so the destination
   number must be a **Verified Caller ID** (Console → Phone Numbers → Verified Caller
   IDs). Trigger a phone verification from the app's verify-phone screen, or:
   ```bash
   # sends a Verify SMS; expect {"sent":true} (no devCode) and the SMS to arrive
   curl -s -X POST https://api-staging.blubranch.com/auth/verify-phone/send \
     -H 'content-type: application/json' -d '{"phone":"+1<your-verified-number>"}'
   ```
   Confirm the SMS arrives. If the token didn't take, the Twilio call fails (500 /
   auth error in the logs) instead of sending — fix before promoting.
4. **Promote the secondary → primary.** On the same Twilio Auth tokens page, **Promote**
   the secondary. This makes it the new primary and **invalidates the old (exposed)
   primary**. The app keeps working because it's already using this token's value.
5. Confirm one more live SMS after promotion.

> **Better long-term option (optional, needs a small code change + deploy):** migrate
> off the account Auth Token to a **Standard API Key** (SID + Secret), initialized as
> `twilio(apiKeySid, apiKeySecret, { accountSid })`. API keys are independently
> revocable without touching the account token, so future rotations don't risk the
> whole account. Defer unless you want it now.

---

## Other secrets (status / not in scope here)

- **Postgres password** — already rotated 2026-07-02 (see CLAUDE.md).
- **Stripe** — currently test-mode keys; they get replaced with live keys at go-live,
  so no separate rotation needed now.
- **S3 secret, Firebase service-account JSON, OpenAI key** — entered via dashboards,
  not exposed in chat; rotate only if you have reason to believe otherwise.
- **JWT_SECRET** — prod uses a freshly generated secret (not the exposed one).

---

## Checklist

- [ ] **Resend:** new sending key created
- [ ] `RESEND_API_KEY` updated on `blubranch` (staging) → verified send
- [ ] `RESEND_API_KEY` updated on `blubranch-mono` (prod) → verified send
- [ ] Old Resend key deleted
- [ ] **Twilio:** secondary auth token generated
- [ ] `TWILIO_AUTH_TOKEN` updated on `blubranch` (staging) → verified SMS
- [ ] `TWILIO_AUTH_TOKEN` updated on `blubranch-mono` (prod) → verified SMS
- [ ] Secondary promoted to primary (old token invalidated)
- [ ] Post-promotion SMS confirmed
