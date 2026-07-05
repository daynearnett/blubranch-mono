# Social sign-in (Apple + Google) — setup & activation

Phase 7 replaced the insecure `/auth/social` stub with real **id_token signature
verification** and added Sign in with Apple + Google buttons to the mobile
welcome/login screens. The code is complete and tested; this doc lists the
**external config** you must supply before it works on a device, and the **one
interactive EAS build** required for the Apple capability.

## What changed in code (already done)

- **API** `packages/api/src/services/social-auth.ts` — verifies Apple/Google
  `idToken` against the issuer's JWKS (signature + `iss` + `aud` + `exp`), derives
  identity from the **verified token only**. `packages/api/src/routes/auth.ts`
  `POST /auth/social` now rejects unverifiable tokens (401), links a provider id
  onto an existing email account, and provisions new users from verified claims.
- **Shared** `socialAuthInputSchema` — client sends only
  `{ provider, idToken, role, firstName?, lastName? }`. Email/sub are **ignored**
  if sent (identity comes from the token). `facebook` removed.
- **Mobile** `src/components/social-auth-buttons.tsx` on `welcome.tsx` + `login.tsx`;
  `signInWithSocial` in `auth-context`; `api.auth.social`.
- 15 tests: `packages/api/src/services/social-auth.test.ts` (crypto: aud/iss/exp/
  signature) + `packages/api/src/social-auth-flow.test.ts` (route provisioning,
  linking, 401, client-email-ignored).

## 1. Google Cloud — OAuth client IDs

You need **two** OAuth 2.0 client IDs in the Google Cloud project (reuse the
Firebase project `blubranch-2e582` or a dedicated one):

1. **Web client** (type: *Web application*) — this becomes the `serverClientId`
   the mobile lib requests and the `aud` the API verifies. Copy its client id
   (`…apps.googleusercontent.com`).
2. **iOS client** (type: *iOS*, bundle id `com.blubranch.app`) — copy its client
   id **and** its *reversed* client id (`com.googleusercontent.apps.<id>`).

Then set:

**API (Railway `blubranch` service + local `.env`):**
```
GOOGLE_CLIENT_IDS=<web-client-id>.apps.googleusercontent.com,<ios-client-id>.apps.googleusercontent.com
```
(Comma-separated; include both so tokens minted for either client verify.)

**Mobile (`apps/mobile/.env` / EAS build env — `EXPO_PUBLIC_*` are inlined at build):**
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
```

**`apps/mobile/app.json`** — replace the placeholder in the
`@react-native-google-signin/google-signin` plugin with the iOS **reversed**
client id:
```json
["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.<ios-client-id>" }]
```

## 2. Apple — Sign in with Apple capability

Apple sign-in is **mandatory** (App Store Guideline 4.8) now that Google is
offered. `app.json` already sets `ios.usesAppleSignIn: true` and adds the
`expo-apple-authentication` plugin. To enable the capability on the App ID you
need **one interactive build** (Apple 2FA — can't be headless):

```
export EXPO_TOKEN=$(cat ~/.config/blubranch/expo-token)
eas build --platform ios --profile preview   # interactive: sign in, 2FA
```

This regenerates the provisioning profile with the *Sign in with Apple*
entitlement. After that first build, headless builds work again:

```
eas build --platform ios --profile preview --non-interactive --auto-submit --no-wait
```

**API audience:** `APPLE_CLIENT_IDS` defaults to the bundle id `com.blubranch.app`
(no action needed). Only set it if you add a web *Services ID*.

## 3. Verify

- Local API tests: `cd packages/api && set -a; source .env; set +a; pnpm exec vitest run src/services/social-auth.test.ts src/social-auth-flow.test.ts`
- On device (after the build): tap **Continue with Apple** / **Continue with
  Google** on Welcome or Login → lands signed-in. A brand-new social user starts
  with an empty worker profile (onboarding fills it in).

## Notes

- New social users get `role: worker` and an empty worker profile. Employer setup
  is still entered later via the "+ tab" hire banner.
- Provider id links to an existing email account automatically, so a user who
  registered with email can later "Continue with Google" on the same address.
- Verification uses `jose` remote JWKS (cached/auto-refreshed). No secrets needed
  server-side for verification — only the allowed client-id audiences above.
