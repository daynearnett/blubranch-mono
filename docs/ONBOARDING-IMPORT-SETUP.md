# Onboarding profile import (LinkedIn + resume) — setup & activation

Onboarding asks **"Want a head start?"** after email verification. Saying yes offers
two import options. The code is complete and tested; this doc lists the **external
config** each option needs before it appears on a device.

Both options **hide automatically when their credentials are unset** (`GET
/imports/config` drives the screen), so shipping this with neither configured is
safe — workers just see the question answered "I'll do it myself" and carry on.

## Set expectations first: what LinkedIn can and cannot give us

LinkedIn's **Sign In with LinkedIn using OpenID Connect** product returns only
`sub / name / given_name / family_name / picture / locale / email / email_verified`
under the `openid profile email` scopes.

It does **not** return positions, skills or education. `r_basicprofile` was
deprecated for new apps on 2023-08-01, and full profile export (the Member Data
Portability API) requires LinkedIn partner approval and is EU-member-only.

So: **LinkedIn fills name, photo and email. The resume import is what fills work
history, skills, headline and bio.** If you only configure one, configure the
resume one — it's also the one that doesn't need an app review, and trade
workers have lower LinkedIn penetration than the white-collar audience LinkedIn
import is usually built for.

## 1. Resume import (Anthropic) — the one that matters

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Set on the Railway **`blubranch`** service:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Redeploy. No code change, no rebuild — `GET /imports/config` starts returning
   `{"resume": true}` and the option appears.

Uses `claude-opus-5` with the PDF passed straight to the Messages API as a
document block (no local text extraction) and a JSON schema for structured
output, at `effort: "low"` since this is extraction rather than reasoning.
Roughly one call per import; a resume is a few thousand input tokens.

**The uploaded file is parsed in memory and discarded.** It is deliberately not
written to S3 — that bucket serves objects publicly with `immutable` cache
headers, which is right for post photos and wrong for someone's resume.

> The mobile half needs **`expo-document-picker`**, a native module, so the
> resume option only appears in a **new EAS build** — it cannot be shipped OTA.
> The LinkedIn option and the question screen itself are JS-only.

## 2. LinkedIn

### 2a. Create the LinkedIn app

1. [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**.
   You need a LinkedIn Company Page to associate it with.
2. **Products** tab → request **"Sign In with LinkedIn using OpenID Connect"**.
   This one is self-serve and usually grants immediately. Do **not** bother
   requesting profile/marketing products — they won't give you work history.
3. **Auth** tab → copy the **Client ID** and **Client Secret**.
4. **Auth** tab → **Authorized redirect URLs for your app** → add, verbatim:
   ```
   https://api-staging.blubranch.com/auth/linkedin/callback
   ```
   and, at prod go-live, `https://api.blubranch.com/auth/linkedin/callback`.
   LinkedIn requires https here, which is why the token exchange happens on the
   server rather than on the device.

### 2b. Railway env vars

On the **`blubranch`** service:

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
PUBLIC_API_URL=https://api-staging.blubranch.com
```

`PUBLIC_API_URL` is what the redirect URI is built from. Override the whole
thing with `LINKEDIN_REDIRECT_URI` if it ever needs to differ. `APP_URL_SCHEME`
defaults to `blubranch` and only needs setting if the app scheme changes.

### 2c. Verify

```bash
curl -s https://api-staging.blubranch.com/imports/config
```

Expect `{"linkedin":true,"resume":true}` once both are set.

## How the LinkedIn flow works (and why it isn't `/auth/social`)

1. App calls `POST /imports/linkedin/start` (authenticated) → gets an authorize URL
   carrying a state nonce bound to that user.
2. App opens it with `expo-linking`'s `Linking.openURL` — **no new native module**;
   `expo-auth-session` / `expo-web-browser` are deliberately not used.
3. LinkedIn redirects to `GET /auth/linkedin/callback`. The server exchanges the
   code for an `id_token` and verifies it against LinkedIn's JWKS
   (`https://www.linkedin.com/oauth/openid/jwks`, issuer `https://www.linkedin.com`).
4. Server redirects to `blubranch://linkedin-import?ticket=...` — a **one-time
   ticket, not the claims**, so no personal data rides in a URL.
5. App posts the ticket to `POST /users/me/import/linkedin` and gets the verified
   claims back for the worker to confirm.

It is **not** routed through `POST /auth/social`: that endpoint is unauthenticated
sign-in-or-provision, and calling it from a signed-in session would swap the
session rather than enrich the profile. Keeping it separate also avoids touching
the `AuthProvider` Prisma enum, so there's no migration.

State and ticket live in Redis with a short TTL, falling back to an in-process map
when Redis is unreachable (the same degradation `lib/socket.ts` already does).
With more than one API instance the fallback could drop a callback that lands on
a different instance; staging and prod both run a single instance with `REDIS_URL`
wired, so that's a degradation path, not the normal one.

## Related change: when the account is created

Registration moved from the **end** of the signup wizard to the end of the
**email** step, so verify → import → location → trade all run authenticated.

Consequence worth knowing: abandoning signup now leaves a real account with a
blank profile. `app/index.tsx` handles it — a signed-in worker with no trade or
no location resumes at `/(auth)/signup-location` instead of landing on the feed.
That also closes a pre-existing hole where social sign-in dropped people on the
feed with an empty profile.

## Nothing is written without confirmation

Both endpoints only **return** parsed data. The app shows the worker what was
found and they tap "Use this" before anything is saved. Beyond the obvious —
a bad parse shouldn't overwrite good data — this matters because
`POST /users/me/work-history` is append-only with **no DELETE route**, so a
silent auto-import that ran twice would duplicate every job.
