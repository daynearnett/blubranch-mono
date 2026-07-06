# Legal pages — Privacy Policy & Terms of Service

## ⚠️ These are DRAFTS, not legal advice

The Privacy Policy and Terms of Service were drafted to describe BluBranch's
**actual** data and service practices as built (accounts, location, photos, SMS
via Twilio, email via Resend, payments via Stripe, Apple/Google sign-in, push via
Firebase, image storage on S3, automated moderation via OpenAI). They **must be
reviewed by qualified legal counsel before public launch.** While unreviewed, each
document renders a yellow "DRAFT for review" banner and the version string ends in
`-draft`.

## Single source of truth

Both documents live as structured data in
[`packages/shared/src/legal/documents.ts`](../packages/shared/src/legal/documents.ts)
(`privacyPolicy`, `termsOfService`). Everything else renders from there, so the
app and web never drift. To edit the text, edit that file, then bump
`version` / `effectiveDate` and rebuild shared (`pnpm --filter @blubranch/shared build`).

## Where they surface

- **Public web (App Store listing URL, crawlers, browser):** the API serves HTML at
  - `GET /legal/privacy`
  - `GET /legal/terms`
  - `GET /legal` (index)
  - Staging: `https://api-staging.blubranch.com/legal/privacy` · Prod (once DNS is live): `https://api.blubranch.com/legal/privacy`
  - **Use one of these as the "Privacy Policy URL" in App Store Connect.**
- **Mobile app:** native screens at `/legal/privacy` and `/legal/terms`
  (`apps/mobile/app/legal/*`), linked from:
  - the Welcome screen footer ("Terms of Service" / "Privacy Policy"),
  - Settings → Privacy policy / Terms of service,
  - the post-job Review screen ("Employer Terms").

## Before launch checklist

- [ ] Legal counsel reviews + finalizes both documents.
- [ ] Remove the `draftBanner` and change `version` from `1.0-draft` → `1.0` (and set a real `effectiveDate`).
- [ ] Confirm the company legal name ("BluBranch, Inc."), contact email (`privacy@blubranch.com`), and governing-law state (Delaware) are correct.
- [ ] Set the public Privacy Policy URL in App Store Connect.
