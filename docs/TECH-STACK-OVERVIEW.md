# BluBranch — Technology overview

> Modeled on [Taist's tech stack overview](https://github.com/TaistApp/taist-mono/blob/main/docs/TECH-STACK-OVERVIEW.md), adapted for BluBranch.

---

## What is BluBranch?

BluBranch is a professional networking and job marketplace platform built for blue-collar skilled workers, tradespeople, and contractors. Workers create profiles showcasing their trade, skills, and certifications, then find local job opportunities and connect with peers. Employers post jobs and hire verified tradespeople in their area.

---

## Platform overview

```
                    ┌──────────────────────────┐
                    │      BluBranch App        │
                    │  iOS + Android + Web      │
                    │  (mobile/tablet/desktop)  │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    BluBranch API          │
                    │   Node.js (Fastify)       │
                    └────────────┬─────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐           ┌─────▼─────┐          ┌─────▼─────┐
    │ Stripe  │           │  Twilio   │          │ Firebase  │
    │Connect  │           │   SMS     │          │   Push    │
    └─────────┘           └───────────┘          │  Notifs   │
                                                 └───────────┘
```

| Layer | What it does |
|-------|-------------|
| Mobile/web app | The app workers and employers use on phones, tablets, and desktop browsers |
| API server | Handles auth, user profiles, job matching, payments, messaging |
| Database | PostgreSQL + PostGIS for all data including geospatial job queries |
| Cache/queues | Redis for sessions, caching, and background job queues |
| Admin panel | React web dashboard for managing users, jobs, and platform operations |

---

## Mobile / web app

| Detail | Value |
|--------|-------|
| Platforms | iOS + Android + Web (single codebase) |
| Framework | React Native + Expo (SDK 52+) |
| Responsive | Mobile (< 768px), Tablet (768–1024px), Desktop (> 1024px) |
| App Store (iOS) | App Store Connect |
| Play Store (Android) | Google Play Console |
| iOS beta testing | TestFlight |
| Android beta testing | APK via EAS |

---

## Backend & hosting

| Detail | Value |
|--------|-------|
| Language | TypeScript (Node.js) |
| Framework | Fastify |
| ORM | Prisma |
| Hosting | Railway |
| Database | PostgreSQL + PostGIS (Railway) |
| Cache/queues | Redis + BullMQ (Railway) |
| Admin panel | React (Vite) web app |

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | api.blubranch.com | Live — real users |
| Staging | api-staging.blubranch.com | Testing before release |
| Admin (prod) | admin.blubranch.com | Production management |
| Admin (staging) | admin-staging.blubranch.com | Test admin features |

---

## Third-party services

| Service | Purpose |
|---------|---------|
| Stripe Connect | Job post payments, employer subscriptions, future worker payouts |
| Twilio | SMS phone verification, job alert notifications |
| Resend | Transactional email (verification, receipts, notifications) |
| Firebase | Push notifications (FCM) to iOS and Android |
| Google Maps | Map display in app, address geocoding for PostGIS |
| OpenAI | AI-powered features (future) |

---

## Scheduled background jobs

| Job | Frequency | Description |
|-----|-----------|-------------|
| Expire stale listings | Hourly | Auto-close jobs past their expiration date |
| Job match notifications | Every 30 min | Notify workers of new jobs matching their trade + location |
| Payment reminders | Daily | Remind employers with pending invoices |
| Profile completion nudges | Weekly | Push notifications encouraging workers to complete profiles |
| Data cleanup | Daily | Remove expired sessions and stale draft job posts |

---

## Source code

| Resource | Value |
|----------|-------|
| Repository | blubranch-mono (private) |
| Monorepo tool | Turborepo |
| Package manager | pnpm |
| Main branch | main (production) |
| Build service (mobile) | Expo EAS |
| Hosting (API) | Railway |

---

## App distribution

### iOS
1. Builds created via Expo EAS
2. Submitted to TestFlight for beta testing
3. Released to App Store via App Store Connect

### Android
1. Builds created via EAS
2. Preview APKs for testing
3. Production builds uploaded to Google Play Console

### Web / desktop
1. Expo web export
2. Deployed to Railway or Vercel as static site

---

## Payment flow

1. Employer selects plan tier (Basic $49 / Pro $129 / Unlimited $299/mo)
2. Stripe Payment Intent (one-time) or Subscription (monthly) created
3. On success → job goes live, matching workers are notified
4. Refunds: admin-initiated only (no refunds after job goes live per terms)
5. Future: Stripe Connect Express for worker payouts (escrow pattern)
