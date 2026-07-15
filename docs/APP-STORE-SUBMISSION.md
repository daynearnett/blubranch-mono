# App Store submission checklist (Phase 7, chunk 8)

Everything needed to submit BluBranch to the iOS App Store. Grounded in the
current setup: bundle `com.blubranch.app`, ASC app id `6764493229`, Apple Team
`WXY2PMFQB7` (Taist, Inc.), Apple ID `a.daynearnett@gmail.com`.

> Order: do the **prereqs** (Stripe live decision, production build config, demo
> account) → **App Store Connect metadata** → **screenshots** → **App Privacy** →
> **build + submit**. Apple review is the slowest external dependency (usually
> 1–3 days) — front-load everything else.

## 0. Prereqs / decisions before the production build

- [ ] **Stripe: live or test for review?** The `production` eas profile points at
      `api.blubranch.com` with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_REPLACE_ME"`.
      Two options:
  - **Recommended:** submit with a **free worker demo account** (workers never
      pay), so the reviewer never hits the payment flow — then you don't need
      Stripe live to pass review. Flip Stripe to live at/after approval.
  - Or flip Stripe live first (see [PROD-GO-LIVE.md](PROD-GO-LIVE.md) §5) and put
      the real `pk_live_…` in the production profile so employer payments work
      during review. Either way, **`pk_live_REPLACE_ME` must not ship** — replace
      it or don't exercise payments in the review notes.
- [ ] **Fill `eas.json` → `submit.production`** (currently placeholders). Use the
      same values already in `submit.preview`:
      `appleId: a.daynearnett@gmail.com`, `ascAppId: 6764493229`,
      `appleTeamId: WXY2PMFQB7`.
- [ ] **Demo account for Apple review** (required — reviewers must be able to sign
      in). Create a stable worker account on **prod** and note its email/password
      for the review form. (Don't rely on Apple/Google sign-in for the reviewer —
      give them email/password.) Optionally a second employer demo account.

## 1. App Store Connect — app metadata

In App Store Connect → the BluBranch app (`6764493229`) → the new version:

- [ ] **Name:** `BluBranch` (30 char max)
- [ ] **Subtitle:** short tagline, e.g. `The network built for the trades` (30 char)
- [ ] **Promotional text** (optional, updatable without review)
- [ ] **Description** — what BluBranch is (two-sided network + job marketplace for
      skilled trades; workers free, employers post jobs). Lead with the value prop.
- [ ] **Keywords** (100 char, comma-sep): e.g. `trades,jobs,blue collar,electrician,
      plumber,contractor,hiring,network,skilled,construction`
- [ ] **Support URL:** a reachable page (e.g. `https://blubranch.com` once the
      under-construction page is replaced, or a support email page).
- [ ] **Marketing URL** (optional).
- [ ] **Category:** Primary `Business` (or `Networking`); Secondary optional.
- [ ] **Age rating:** complete the questionnaire → likely **4+** (no objectionable
      content; note user-generated content is moderated — see App Privacy).
- [ ] **Copyright:** `© 2026 BluBranch, Inc.`

## 2. Screenshots (per form factor)

The app is responsive (`supportsTablet: true`), so **iPad screenshots are
required** in addition to iPhone. Apple now only needs the **largest** size per
family (it down-scales for smaller devices):

- [ ] **iPhone 6.9"** (1320 × 2868 portrait) — iPhone 16 Pro Max class. **Required.**
- [ ] **iPad 13"** (2064 × 2752 portrait) — **required because tablet is supported.**
      *(Alternative: set `ios.supportsTablet: false` in app.json to drop the iPad
      requirement — only if you don't want to market iPad support.)*
- Provide **3–10** per size. Suggested screens: Welcome/sign-in, Home feed, Job
  detail, Job search/results, Profile ("My Branch"), Post-a-job (employer),
  Messages.
- **How to capture:** run the app in the iOS Simulator at the exact device
  (iPhone 16 Pro Max, iPad Pro 13") → `Cmd+S` saves a correctly-sized PNG. Or use
  a real device screenshot. (I can script simulator captures if you want — see
  note at bottom.)
- Optional: add text captions/framing, but raw screenshots are acceptable.

## 3. App Privacy ("nutrition label") — required

App Store Connect → App Privacy → answer the data-collection questionnaire.
Based on what BluBranch actually collects:

- [ ] **Contact Info:** Name, Email, Phone — *App Functionality*, linked to user.
- [ ] **Location:** Coarse location (city/region) — *App Functionality*, linked.
- [ ] **User Content:** Photos, posts, messages — *App Functionality*, linked.
- [ ] **Identifiers:** User ID; Device ID / push token — *App Functionality*.
- [ ] **Financial Info:** handled by **Stripe** (you don't store card numbers) —
      disclose "Payment Info" collected for *App Functionality* (by the processor).
- [ ] **Usage Data:** product interaction / analytics (job views, searches) —
      *Analytics*, linked.
- [ ] **Tracking:** **No** cross-app/third-party ad tracking → **no ATT prompt
      needed**, and answer "No" to "used to track you." (Confirm no ad SDKs.)
- [ ] **Privacy Policy URL:** `https://api.blubranch.com/legal/privacy` ✅ (live).

## 4. Sign in with Apple / third-party login

- [x] Sign in with Apple is implemented + capability enabled (Guideline 4.8 met,
      since Google is also offered). Official Google logo now used (branding).

## 5. Export compliance

- [x] `app.json` sets `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` — so no
      export-compliance docs are needed (standard HTTPS only). App Store Connect
      won't block on the encryption question.

## 6. Build + submit

- [ ] Build the **production** binary (App Store distribution):
      ```
      export EXPO_TOKEN=$(cat ~/.config/blubranch/expo-token)
      cd apps/mobile
      eas build --platform ios --profile production --auto-submit
      ```
      (Run from `apps/mobile/`, not the repo root — see PROD-GO-LIVE / eas notes.)
- [ ] In App Store Connect: attach the build to the version, fill **App Review
      Information** (demo account creds from §0, contact info, notes — e.g. "Workers
      are free; use the demo worker account to review core flows").
- [ ] Answer the **Content Rights** + **Advertising Identifier (IDFA)** questions
      (IDFA: **No**, unless you add an ad SDK).
- [ ] **Submit for Review.**

## 7. Common rejection risks to pre-empt

- **Broken payment during review** → mitigate with the free worker demo account (§0).
- **Sign-in not testable** → provide email/password demo creds (Apple can't do your
  Apple/Google 2FA).
- **UGC without moderation/report flow** → you have auto-moderation + report +
  block; mention it in review notes (Guideline 1.2).
- **Placeholder content / dead links** → ensure Support URL resolves.

---

## Note: I can script the screenshots

If you get the app running in the iOS Simulator (or point me at a simulator), I
can drive it to the key screens and capture correctly-sized PNGs for both the
iPhone 6.9" and iPad 13" — just say the word.
