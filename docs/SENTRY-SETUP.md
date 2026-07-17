# Sentry activation runbook (do-it-now)

Sentry is already wired in code for **both** the API and mobile app and is a
no-op until a DSN is present (see [MONITORING.md](./MONITORING.md) for the code
map). This doc is the click-through to turn it on.

**Timeline note:**
- **API Sentry = activate now.** One Railway env var, redeploys, no rebuild. This
  is the high-value one — it catches every server 500 and startup crash.
- **Mobile Sentry = next build.** `EXPO_PUBLIC_SENTRY_DSN` is inlined into the JS
  bundle at build time, so it only goes live in a build made *after* you set it.
  It will NOT be active in build `0.1.5 (30)` (the one now in App Store Connect).
  That's fine — add it to the next build; it isn't a launch blocker.

---

## Step 1 — Create the Sentry account + org (one time)

1. Go to <https://sentry.io/signup/> and sign up (free "Developer" tier is enough
   for one app; or "Team" if you want more retention/alerts later).
2. Sign in with the same email you use for the rest of BluBranch infra.
3. Note your **org slug** — it's in the URL after you log in:
   `https://<org-slug>.sentry.io/…`. You'll need it for mobile source maps.

## Step 2 — Create TWO projects

Sentry projects are per-platform. Create two so API and mobile errors stay separate.

1. **Projects → Create Project → Platform: Node.js** (Fastify works under Node).
   - Name: `blubranch-api`
   - On the setup screen, copy the **DSN** (looks like
     `https://<hash>@o<org>.ingest.us.sentry.io/<projectid>`). Call this **`API_DSN`**.
2. **Create Project → Platform: React Native.**
   - Name: `blubranch-mobile`
   - Copy its **DSN**. Call this **`MOBILE_DSN`**.

You can skip/ignore the code snippets Sentry shows on those screens — the code is
already integrated.

---

## Step 3 — Activate the API (NOW, no rebuild)

Set `SENTRY_DSN=<API_DSN>` on the Railway **`blubranch-mono`** service (production)
and, if you want staging coverage too, on the **`blubranch`** service (staging).

**Railway dashboard (most reliable):**
1. Railway → `blubranch-production` project → `blubranch-mono` service → **Variables**.
2. **New Variable** → `SENTRY_DSN` = `<API_DSN>` → save. Railway redeploys.
3. (Optional) also add `SENTRY_TRACES_SAMPLE_RATE` (default `0.1` is fine).
   `SENTRY_RELEASE` auto-fills from the Railway commit sha.

**Or CLI** (must be logged in as the personal account `a.daynearnett@gmail.com`):
```bash
railway variables --set "SENTRY_DSN=<API_DSN>" --service blubranch-mono
# staging too, optional:
railway variables --set "SENTRY_DSN=<API_DSN>" --service blubranch
```

**Verify:** after the redeploy, the boot log line changes from the no-DSN path to
an initialized Sentry. Then trigger any error and confirm it lands:
```bash
# 500s are captured automatically; the quickest smoke test is any handled 500.
# Or watch the Sentry project's "Issues" for the first event after a real error.
curl -i https://api.blubranch.com/health   # confirm service is up post-deploy first
```
The Node project's onboarding screen shows "Waiting for the first event…" until one
arrives; the first real 500 (or a deploy-time startup error) clears it.

---

## Step 4 — Activate mobile (on the NEXT build)

`EXPO_PUBLIC_SENTRY_DSN` must be present in the EAS build env. Add it to the
`preview` and `production` profiles' `env` block in
[apps/mobile/eas.json](../apps/mobile/eas.json):

```jsonc
"env": {
  "EXPO_PUBLIC_API_URL": "https://api.blubranch.com",
  "EXPO_PUBLIC_SENTRY_DSN": "<MOBILE_DSN>",   // ← add this line
  …
}
```
(Optional: `EXPO_PUBLIC_ENV` sets the Sentry environment label; defaults to
`production`.)

Then the next `eas build` bakes it in and native crashes + JS errors report.

### Optional but recommended: readable mobile stack traces (source maps)

Without this, mobile stack traces are minified. To upload source maps at build
time you need three things in the EAS build env and one config flag removed:

1. Create a Sentry **auth token** with `project:releases` + `org:read` scope:
   Sentry → Settings → Auth Tokens → **Create New Token**. Call it `SENTRY_AUTH_TOKEN`.
2. Store it as an EAS secret (never commit it):
   ```bash
   cd apps/mobile
   eas env:create --scope project --name SENTRY_AUTH_TOKEN --value "<token>" \
     --visibility secret --environment production
   # repeat with --environment preview if you want source maps on staging builds
   ```
3. Add `SENTRY_ORG=<org-slug>` and `SENTRY_PROJECT=blubranch-mobile` to the
   `preview`/`production` `env` in `eas.json` (these are not secret).
4. **Remove** `"SENTRY_DISABLE_AUTO_UPLOAD": "true"` from those profiles' `env`
   (it's there now specifically to keep builds green while Sentry was unconfigured;
   with the token + org + project present, upload works and the build stays green).

> The `@sentry/react-native` Expo plugin skips the upload silently if the auth
> token is missing, so a half-configured build never breaks — but you also get no
> source maps. All four pieces above are needed for readable traces.

---

## Step 5 — External uptime (do at go-live)

Railway's `/health` check only restarts the container; it can't tell you the whole
service is down. Point a free external monitor at:
- `https://api.blubranch.com/health` (prod)
- `https://api-staging.blubranch.com/health` (staging)

Provider: **Better Stack** or **UptimeRobot** (free tier, 1–3 min interval, alert to
email/Slack). 5 minutes to set up; not a code change.

---

## Summary checklist

- [ ] Sentry account + org created; org slug noted
- [ ] `blubranch-api` (Node) project → `API_DSN` copied
- [ ] `blubranch-mobile` (React Native) project → `MOBILE_DSN` copied
- [ ] **API live:** `SENTRY_DSN` set on Railway `blubranch-mono` (+ `blubranch` staging) → redeployed → first event seen
- [ ] **Mobile (next build):** `EXPO_PUBLIC_SENTRY_DSN` added to `eas.json` preview+production
- [ ] (Optional) mobile source maps: `SENTRY_AUTH_TOKEN` EAS secret + `SENTRY_ORG`/`SENTRY_PROJECT` in `eas.json` + remove `SENTRY_DISABLE_AUTO_UPLOAD`
- [ ] (Go-live) external uptime monitor on `/health`
