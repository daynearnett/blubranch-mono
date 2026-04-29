# BluBranch — iOS TestFlight build playbook

> First-time setup for shipping iOS preview builds via Expo EAS Build → App
> Store Connect → TestFlight Internal Testing.

---

## What's already configured

| File | What it sets |
|------|-------------|
| `apps/mobile/app.json` | name, slug, version, bundle id, plugins (image-picker permissions, secure-store, splash-screen, build-properties), iOS deployment target 15.1 |
| `apps/mobile/eas.json` | three build profiles (development / preview / production) + iOS submit config templates |
| `apps/mobile/.easignore` | upload exclusions |
| `apps/mobile/assets/{icon,adaptive-icon,splash,favicon}.png` | **placeholder** brand-colored squares — replace with real artwork before App Store review |
| eas-cli installed globally | `eas-cli/18.x` |

**Bundle ID:** `com.blubranch.app`
**Version:** `0.1.0`
**iOS minimum:** 15.1

---

## What you'll need before running anything

1. **Apple Developer Program membership** (active, $99/year) — confirm at <https://developer.apple.com/account>
2. **Apple ID email** that owns the Developer membership
3. **Apple Team ID** — find at <https://developer.apple.com/account> → Membership → Team ID (10-char string like `9X4ABCDEFG`)
4. **Expo account** — sign up at <https://expo.dev> if you haven't already (free)
5. (Optional but recommended) **App-specific password** for Apple ID — generate at <https://account.apple.com/account/manage> → Sign-in & Security → App-Specific Passwords. EAS will use this for non-interactive App Store submissions.

You do NOT need to pre-create the bundle ID in Apple Developer Portal or the app in App Store Connect — EAS can do both for you on first run.

---

## Step-by-step commands

All commands are run from `apps/mobile/`:

```bash
cd apps/mobile
```

### 1. Log in to EAS

```bash
eas login
```

Prompts for your Expo username + password. Stores the session in `~/.expo`.

Verify with:

```bash
eas whoami
```

### 2. Initialize the EAS project

```bash
eas init
```

This:
- Asks which Expo account/org to attach the project to
- Creates the project at `https://expo.dev/accounts/<you>/projects/blubranch`
- Writes the project ID into `app.json` under `extra.eas.projectId`

Commit the change.

### 3. Verify the project is wired up

```bash
eas project:info
```

Should show the project name `blubranch`, owner, and project ID.

### 4. Trigger the iOS preview (TestFlight) build

```bash
eas build --platform ios --profile preview
```

On the first run, EAS asks a series of one-off setup questions — answer interactively:

| Prompt | What to answer |
|--------|---------------|
| "Apple ID" | Your Apple Developer email |
| "Apple Team ID" | Your 10-char Team ID |
| "Generate a new Apple Distribution Certificate?" | **Yes** (EAS manages it) |
| "Generate a new Provisioning Profile?" | **Yes** |
| "Register the bundle identifier `com.blubranch.app`?" | **Yes** |
| "Create an App Store Connect API key?" | **Yes** (required for `eas submit` later) |

EAS handles all of the cert / provisioning / bundle ID registration. The credentials live on Expo's servers and survive across builds — you don't need to repeat this.

The build runs on EAS's macOS machines (~10–20 min for a Pro plan, longer on free tier). When it finishes you'll see a download URL for the `.ipa`.

### 5. Submit the build to TestFlight

```bash
eas submit --platform ios --profile preview
```

EAS uploads the latest preview build to App Store Connect. First run prompts:

| Prompt | What to answer |
|--------|---------------|
| "Apple ID" | Your Apple Developer email (same as above) |
| "App-specific password" | Generated at account.apple.com (or skip and use API key) |
| "Create a new app on App Store Connect?" | **Yes** if this is the first submission |

After upload, App Store Connect runs an automated check (~5 min). Then:

1. Go to <https://appstoreconnect.apple.com>
2. My Apps → BluBranch → TestFlight
3. The build appears under "iOS Builds"
4. Add yourself (and any other internal testers) to the **Internal Testing** group
5. Apple Mail sends an invite with a link to install via TestFlight

For external testers (>25 invitees, public link), you'll need a one-time **Beta App Review** from Apple (~24h). Internal testers don't need that.

---

## Updating `eas.json` `submit` block

Once you have your Apple credentials, replace the placeholders in `apps/mobile/eas.json`:

```jsonc
"submit": {
  "preview": {
    "ios": {
      "appleId": "you@example.com",                          // your Apple ID
      "ascAppId": "1234567890",                              // App Store Connect app ID (from URL after creating the app)
      "appleTeamId": "9X4ABCDEFG"                            // 10-char Team ID
    }
  }
}
```

`ascAppId` you get *after* the first `eas submit` creates the app — it's the numeric ID in the App Store Connect URL: `appstoreconnect.apple.com/apps/<ascAppId>/...`. Once filled in, future submissions are non-interactive.

---

## Environment variables / secrets

The mobile app reads `EXPO_PUBLIC_API_URL` to know where to talk. It's set per-profile inside `eas.json` `build.<profile>.env`:

| Profile | API URL |
|---------|---------|
| `development` | `http://localhost:4000` |
| `preview` | `https://api-staging.blubranch.com` ← **placeholder until Railway is up** |
| `production` | `https://api.blubranch.com` |

`EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time. They are NOT secret — anyone with the IPA can extract them. That's fine for the API base URL; it would not be fine for things like Stripe keys.

For real secrets (Stripe publishable keys, Sentry DSN, etc.) once Phase 5+ ships:

```bash
# Server-only secret (NOT exposed to the client bundle):
eas secret:create --scope project --name SOME_SECRET --value "..."

# Client-bundled secret (visible in the IPA — only use for genuinely public values):
# Add it to env in eas.json under the appropriate profile
```

When the staging API lands on Railway, update `EXPO_PUBLIC_API_URL` in `eas.json` and re-run `eas build`.

---

## When you bump version vs. when you rebuild

`appVersionSource: "remote"` in eas.json means EAS manages the iOS `buildNumber` and Android `versionCode` automatically (incrementing on each build). You only need to bump:

- `version` (semver in app.json) when the public-facing version changes — bump for each TestFlight cycle that you want testers to recognize
- The `buildNumber` field in app.json is ignored when `appVersionSource: "remote"` — leave it alone

For TestFlight you typically want: same `version` across multiple TestFlight builds while iterating, then bump version for the App Store release.

---

## Common first-build issues

1. **"No EAS project configured."** — run `eas init`.
2. **"Bundle identifier `com.blubranch.app` already in use."** — someone else owns it on Apple's side. Pick a new id (e.g. `com.blubranch.mobile`) in `app.json`, run `eas init` again.
3. **"You must accept the latest Apple Developer Program License."** — log in to <https://developer.apple.com/account> and accept the agreement banner.
4. **Asset validation errors** — the placeholder icons we shipped are valid (1024×1024 RGB, no alpha) but visually empty. Replace before App Store review with real artwork. EAS will accept TestFlight builds with the placeholder.
5. **"This build is invalid: missing UIBackgroundModes"** — already covered in app.json.
6. **Plugin / dep mismatch warnings on `eas build`** — we explicitly pinned everything to Expo SDK 52. If you see warnings, run `pnpm exec expo install --check` and accept the suggested versions.
