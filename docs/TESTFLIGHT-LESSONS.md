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

## Build command sequence (known-good)
```bash
cd apps/mobile
# 1. Bump version in app.json (version + ios.buildNumber)
# 2. Build
eas build --platform ios --profile preview
# 3. Submit (only after build succeeds)
eas submit --platform ios --profile preview
```

## EAS account setup
- Expo account: [a.daynearnett@gmail.com](mailto:a.daynearnett@gmail.com) (personal, separate from Taist EAS account)
- Apple Developer: [a.daynearnett@gmail.com](mailto:a.daynearnett@gmail.com), Team ID WXY2PMFQB7
- ASC App ID: 6764493229
- Former Taist developer was scoped to App Manager for Taist apps only — no visibility into BluBranch
