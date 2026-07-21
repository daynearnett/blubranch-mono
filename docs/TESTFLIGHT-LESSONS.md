# TestFlight Build & Submission — Lessons Learned

## Issue 1: Distribution certificate limit
- Apple allows only 3 iOS Distribution Certificates per account
- Our account had 3 existing Taist certificates, blocking a new one for BluBranch
- Fix: Revoked the oldest certificate directly in Apple Developer Portal (developer.apple.com/account/resources/certificates/list), then re-ran `eas build`
- Note: Distribution certificates are NOT app-specific — revoking one doesn't break already-published apps, only future builds that reference that specific cert
- Note: EAS CLI's interactive revoke picker can loop/fail — revoking directly in the Apple portal is more reliable

## Issue 2: iOS SDK version rejection
- Apple requires iOS 26 SDK (Xcode 26) as of early 2026
- Default EAS build image used Xcode with iOS 18.2 SDK — Apple rejected the IPA on submission
- Fix: Added explicit `"image": "macos-sequoia-15.6-xcode-26.2"` to `build.preview.ios` and `build.production.ios` in eas.json
- Never rely on EAS default image — always pin explicitly

## Issue 3: Launch crash (SIGABRT on expo.controller.errorRecoveryQueue)
- App crashed immediately on launch — no JS ever rendered
- Root cause: Expo SDK 52 is not fully compatible with Xcode 26 / iOS 26 at the native level
- First attempted fix (insufficient): Added react-native-reanimated babel plugin — did not resolve the native crash
- Second attempted fix (also insufficient): Added error boundaries + hardened auth bootstrap — good defensive code but didn't fix the native crash
- Actual fix: Upgraded Expo SDK 52 → SDK 55, which is the officially supported SDK for Xcode 26
- Key dependency changes: React 18→19, RN 0.76→0.83, Reanimated 3→4, babel plugin moved from `react-native-reanimated/plugin` to `react-native-worklets/plugin`
- Lesson: When Apple bumps the required Xcode/SDK version, always check if your Expo SDK version is still supported on that toolchain. If not, upgrade Expo SDK first before debugging anything else.

## Issue 4: Submission credentials
- eas.json had placeholder values for appleId, appleTeamId, ascAppId
- Fix: Set real values — appleId: actual email, appleTeamId: from Apple portal, removed ascAppId (EAS auto-detects on first submission)

## Issue 5: Version/build number collisions
- Apple rejects re-uploads with the same version + buildNumber combo
- `npm version patch` only bumps package.json, NOT app.json — Apple reads app.json
- Fix: Always bump BOTH `version` and `ios.buildNumber` in app.json before rebuilding
- Convention going forward: increment buildNumber for every TestFlight submission

> **Update (2026-04-30):** the above advice applies to projects where EAS reads native build metadata from `app.json`. BluBranch's `eas.json` sets `"appVersionSource": "remote"`, which moves `buildNumber` ownership to EAS — EAS auto-increments it on every build, and any value in `app.json#ios.buildNumber` is ignored. Under remote versioning, the rule simplifies to: bump only `version` in `app.json` when you want a new visible version string; do not touch `buildNumber`. See Issue 7 for the discipline that replaced this one.

## Issue 6: API URL hardcoded in eas.json — temporary Railway URL pattern
- After the API went live on Railway but **before** custom domains (`api-staging.blubranch.com`, `api.blubranch.com`) were set up at the registrar, the mobile app needed to point at the Railway-generated URL (`https://blubranch-production.up.railway.app`) for one TestFlight build.
- Two structural choices for how to make a URL switch buildable:
  1. **Per-profile env var in `eas.json`** (BluBranch's current pattern). Each profile defines `EXPO_PUBLIC_API_URL` directly, e.g. `preview` → `https://api-staging.blubranch.com`. The mobile app's `src/lib/api.ts` reads `process.env.EXPO_PUBLIC_API_URL` at build time, no in-app switching. Swapping URLs means editing `eas.json` and rebuilding.
  2. **APP_ENV flag + in-app URL switcher** (Taist's pattern). `eas.json` sets `APP_ENV=staging|production` per profile; the app has a switch statement (Taist's lives in `app/services/api.ts`) that maps APP_ENV to a hardcoded URL constant. Swapping URLs means editing the app code, not `eas.json`.
- Decision for this build: temporarily put the Railway URL into `eas.json#build.preview.env.EXPO_PUBLIC_API_URL`, ship a TestFlight build, defer the custom-domain DNS step (RAILWAY-DEPLOY.md step 9). Rationale: ~15 minutes to ship vs. the ~30 minutes for DNS + cert provisioning, and onboarding wasn't going to be tested-and-found-broken in ways the URL would change.
- **Follow-up debt:** when `api-staging.blubranch.com` is set up, `eas.json#build.preview.env.EXPO_PUBLIC_API_URL` must be reverted to that custom domain. Tracking this as a TODO is fragile because the URL works fine in the build (the test isn't "did I forget to revert"); the only way to notice the staleness later is to check the diff. **Do not commit the temporary Railway URL to `main`** — keep the change on a short-lived branch, or stash it after the build completes, so the next person to build doesn't accidentally inherit a stale URL.
- Lesson: when a temporary URL needs to be baked into a build, the swap itself is trivial — the discipline is around (a) not letting the temporary value drift to the default branch and (b) building a revert-checklist when the permanent URL is finally available, because there's no automatic signal that the URL is stale.

## Issue 7: Version-bump discipline under `appVersionSource: "remote"`
- Issue 5 (above) said "increment buildNumber for every TestFlight submission." That was correct for projects with `appVersionSource: "local"` (Taist's convention; native iOS/Android dirs present). BluBranch is **managed Expo** with `appVersionSource: "remote"` — EAS owns `buildNumber` and auto-increments it; whatever is in `app.json#ios.buildNumber` is ignored.
- Under remote versioning, the actionable rule is just: bump `app.json#version` (e.g. `0.1.2` → `0.1.3`) before each TestFlight submission, leave `buildNumber` alone, let EAS auto-assign it. Two builds at the same `version` will appear in TestFlight as `0.1.3 (3)` and `0.1.3 (4)`.
- Convention adopted: bump the patch component (`0.1.2 → 0.1.3 → 0.1.4`) for each iteration build. Bump the minor component (`0.1.x → 0.2.0`) at meaningful milestones (e.g. "first build that completes onboarding end-to-end"). Reserve major bumps for production releases.
- Lesson: which file to bump and which fields to touch are entirely a function of `eas.json#cli.appVersionSource`. Read that field before following any version-bump advice in another doc — including this one.

## Issue 8: Database not seeded → onboarding screens 500 on the backend
- After the API went live and a TestFlight build was installed on a real device, the worker-onboarding flow (signup → trade selection) failed at trade-selection: the screen called `GET /reference/trades` and got an empty array, so the dropdown had no options.
- Cause: the deployed Postgres was empty. The Prisma migrations created tables but never populated reference data (trades, skills, benefits). The seed script existed at `packages/db/prisma/seed.ts` but had only ever been run against local Postgres during development.
- Fix: run the seed against Railway's Postgres once. Documented step in RAILWAY-DEPLOY.md (step 8); the actual mechanics turned out to be more involved than the docs suggested — see RAILWAY-LESSONS.md issues 15 and 16 for the seeding pitfalls.
- Lesson: a successful API deploy + a running database != a working app. Seed/reference data is its own deploy step, easy to forget because it only runs once per environment. Treat "seed has been run on this environment" as a checklist item independent of "API has been deployed to this environment."

## Build command sequence (known-good, post-onboarding)
```bash
cd apps/mobile
# 1. Bump app.json#version (e.g. 0.1.2 -> 0.1.3). Don't touch buildNumber — EAS handles it.
# 2. (If the API URL changed) edit eas.json env for the right profile.
# 3. Build
eas build --platform ios --profile preview
# 4. Submit (only after build succeeds)
eas submit --platform ios --profile preview
```

## EAS account setup
- Expo account: [a.daynearnett@gmail.com](mailto:a.daynearnett@gmail.com) (personal, separate from Taist EAS account)
- Apple Developer: [a.daynearnett@gmail.com](mailto:a.daynearnett@gmail.com), Team ID WXY2PMFQB7
- ASC App ID: 6764493229
- Former Taist developer was scoped to App Manager for Taist apps only — no visibility into BluBranch

## Issue 5: Builds 31+32 launch crash — `expo install` pulled a react-navigation package incompatible with expo-router's pins (2026-07-20)
- Symptom: white flash → SIGABRT on `expo.controller.errorRecoveryQueue`. That queue name means expo-updates error recovery aborted on a **fatal JS error during bundle evaluation** — it is NOT a native-module crash, even though it looks like one.
- Root cause: `expo install @react-navigation/material-top-tabs` installed the **latest** version (7.6.10) because non-Expo-managed packages aren't version-pinned by `expo install`. 7.6.10 imports `createScreenFactory` from `@react-navigation/native` — an export that doesn't exist in the `7.2.2` that expo-router SDK 55 pins. The tabs route calls `createMaterialTopTabNavigator()` at module scope and **expo-router eagerly evaluates every route file at startup**, so one bad import = instant crash for every user, before any UI (even the splash overlay) can mount.
- Wasted cycle: build 32 bumped `react-native-pager-view` 8.0.0→8.0.4 on circumstantial evidence (only native delta + plausible GitHub issues). Get the `.ips` crash log FIRST — `legacyInfo.threadTriggered.queue` told the real story in one line.
- Fix: pin `@react-navigation/material-top-tabs@7.4.24` — the newest version whose `@react-navigation/native` peer (`^7.2.2`) is satisfied by expo-router's pin. Verified by grepping its imports against the installed package's actual exports.
- Lessons:
  1. When adding any `@react-navigation/*` package, check its `peerDependencies` against the versions expo-router already installed (`node_modules/@react-navigation/native/package.json`) — `pnpm install`'s "unmet peer" warning is a launch crash foretold, not noise.
  2. TypeScript can't catch missing runtime exports across package boundaries. Before a TestFlight build with new deps, do a runtime smoke: dev-server launch or simulator run. (Web export doesn't work as a smoke — Stripe's native-only imports break it.)
  3. Crash triage order: get `.ips` from Settings → Privacy & Security → Analytics Data. `Exception Type` + `legacyInfo.threadTriggered.queue` classify it (errorRecoveryQueue ⇒ JS init failure) before touching any dependency.
