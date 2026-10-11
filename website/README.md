# blubranch-website

Marketing site for BluBranch (blubranch.com). Plain static HTML + CSS, no build step.

## Contents

- `index.html`: the whole site (inline CSS, system font stack like the app, no web fonts)
- `assets/logo-mark.svg`: vector logo mark, recreated from the geometry in `apps/mobile/src/components/animated-logo.tsx` in `blubranch-mono`
- `assets/apple-touch-icon.png`, `assets/favicon.png`: copied from `apps/mobile/assets/` in `blubranch-mono`
- `assets/og-image.png`: copied from `packages/api/assets/og-logo.png` in `blubranch-mono`

Styled after the mobile app's light theme (`apps/mobile/src/theme.ts`): Workwear Denim primary buttons, CAT Yellow accents, 8px card radius. Worker-focused, with no app screenshots or UI mockups (pre-launch mystery); each section has an abstract brand animation that plays on scroll (respects `prefers-reduced-motion`). Employers get one short strip above the footer.

## Waitlist

Both forms (hero + closing) validate the email client-side. Set `WAITLIST_ENDPOINT` in the inline script to go live; it POSTs `{ email, role: 'worker' | 'employer', source: 'website' }` as JSON. Until then, submitting shows "Waitlist signups open in a few days."

## Preview locally

```sh
npx serve .        # or: python3 -m http.server
```

## Before going live

- [ ] Point the footer Privacy/Terms links at the production API (`api.blubranch.com/legal/*`) once prod DNS is live; they currently use staging.
- [ ] Build the waitlist backend and set `WAITLIST_ENDPOINT` in `index.html`.
- [ ] Deploy (e.g. Vercel: `vercel deploy --prod` from this folder) and point `blubranch.com` DNS at it.
