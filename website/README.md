# blubranch-website

Marketing site for BluBranch (blubranch.com). Plain static HTML + CSS, no build step.

## Contents

- `index.html`: the whole site (inline CSS; Archivo + IBM Plex Mono from Google Fonts)
- `assets/logo-mark.svg`: vector logo mark, recreated from the geometry in `apps/mobile/src/components/animated-logo.tsx` (blubranch-mono)
- `assets/apple-touch-icon.png`, `assets/favicon.png`: copied from `apps/mobile/assets/`
- `assets/og-image.png`: copied from `packages/api/assets/og-logo.png`

Colors match the app's Workwear Denim + CAT Yellow tokens (`apps/mobile/src/theme.ts`), including dark mode.
Employer pricing matches `packages/shared/src/schemas/payment.ts` (Basic $19/post, Blu $79/mo, Blu Max $139/mo).

## Preview locally

```sh
npx serve .        # or: python3 -m http.server
```

## Before going live

- [ ] Confirm `hello@blubranch.com` exists (or swap the contact address in the "Get in early" section).
- [ ] Point the footer Privacy/Terms links at the production API (`api.blubranch.com/legal/*`) once prod DNS is live; they currently use staging.
- [ ] Replace the email CTA with a real waitlist form or App Store link at launch.
- [ ] Deploy (e.g. Vercel: `vercel deploy --prod` from this folder) and point `blubranch.com` DNS at it.

## Moving to its own repo

This folder was staged in `blubranch-mono` on branch `claude/blubranch-website`. To split it out:

```sh
cd ~/Dev
git clone https://github.com/daynearnett/blubranch-mono.git tmp-bb
cd tmp-bb && git checkout claude/blubranch-website
cp -R website ~/Dev/blubranch-website && cd ~/Dev && rm -rf tmp-bb
cd blubranch-website && git init && git add . && git commit -m "Initial BluBranch website"
# create an empty daynearnett/blubranch-website repo on GitHub, then:
git remote add origin https://github.com/daynearnett/blubranch-website.git
git branch -M main && git push -u origin main
```
