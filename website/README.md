# blubranch-website

Marketing site for BluBranch (blubranch.com). Plain static HTML + CSS, no build step.

## Contents

- `index.html`: the whole site (inline CSS, system font stack like the app, no web fonts)
- `assets/logo-mark.svg`: vector logo mark, recreated from the geometry in `apps/mobile/src/components/animated-logo.tsx` (blubranch-mono)
- `assets/apple-touch-icon.png`, `assets/favicon.png`: copied from `apps/mobile/assets/`
- `assets/og-image.png`: copied from `packages/api/assets/og-logo.png`

Styled after the mobile app's light theme (`apps/mobile/src/theme.ts`): Workwear Denim primary buttons, CAT Yellow accents, 8px card radius. The Trade Card, job card and plan cards mirror their app components.
Employer pricing matches `packages/shared/src/schemas/payment.ts` (Basic $19/post, Blu $79/mo, Blu Max $139/mo).

## Preview locally

```sh
npx serve .        # or: python3 -m http.server
```

## Before going live

- [ ] Point the footer Privacy/Terms links at the production API (`api.blubranch.com/legal/*`) once prod DNS is live; they currently use staging.
- [ ] Swap the "Coming soon to the App Store" pill for the real App Store link at launch (or add a waitlist form).
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
