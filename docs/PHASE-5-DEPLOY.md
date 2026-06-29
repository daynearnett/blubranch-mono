# Phase 5 — Stripe payments deploy playbook

> Read this before deploying Phase 5. Code is complete + tested (branch
> `phase-5-payments`); going live needs a Stripe account set up and env vars
> wired. **Use TEST MODE end-to-end first.** Scope: employer→platform payments
> only (Basic one-time + Pro/Unlimited subscriptions). Worker Connect payouts are
> deferred post-beta.

## What Phase 5 ships

- **Basic $19/post** — one-time PaymentIntent per job post. The job is
  created as a `draft` and only flips to `open` once Stripe confirms payment
  (webhook `payment_intent.succeeded`, with a server-side `/confirm` backstop).
- **Pro $199/mo** and **Unlimited $299/mo** — Stripe Subscriptions (tier-ranked:
  Unlimited covers Pro). While an active sub covers the job's tier, posting is
  free (jobs go straight to `open`). Otherwise `POST /jobs` returns
  `402 subscription_required`.
- **Mobile**: native Stripe Payment Sheet (`@stripe/stripe-react-native`) in the
  post-job review step. **Requires a new EAS build** (native module added).
- **Webhooks**: `/webhooks/stripe` (raw-body, signature-verified) handles
  `payment_intent.succeeded` / `payment_intent.payment_failed` /
  `customer.subscription.*` / `invoice.paid` / `invoice.payment_failed`.
- **Receipts**: emailed via Resend on successful one-time payment + first sub
  invoice.
- **Graceful degradation**: when `STRIPE_SECRET_KEY` is unset/placeholder, all
  payment routes 503 and `POST /jobs` falls back to immediate `open` (preserves
  pre-Phase-5 dev behavior).

## One-time Stripe account setup (test mode)

1. **Create / log into Stripe**, switch to **Test mode**.
2. **Create the subscription prices**: Products → add two products:
   "BluBranch Pro" recurring **$199.00 / month** → `STRIPE_PRICE_PRO`, and
   "BluBranch Unlimited" recurring **$299.00 / month** → `STRIPE_PRICE_UNLIMITED`.
   (Basic needs no product — its $19 amount is set inline on the PaymentIntent.)
3. **Get API keys**: Developers → API keys → copy the **Secret key** (`sk_test_…`)
   → `STRIPE_SECRET_KEY`, and the **Publishable key** (`pk_test_…`) →
   `STRIPE_PUBLISHABLE_KEY` (server) **and** `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   (mobile build, see eas.json).
4. **Create the webhook endpoint**: Developers → Webhooks → Add endpoint →
   URL `https://api-staging.blubranch.com/webhooks/stripe`. Select events:
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

## Railway env vars (staging `blubranch` service)

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_PRO=price_…
STRIPE_PRICE_UNLIMITED=price_…
```

> ⚠️ Env-var changes on Railway trigger a redeploy that **rebuilds from the
> GitHub-connected branch (`main`)** — so merge `phase-5-payments` → `main` and
> push BEFORE setting these, or the redeploy serves code without the payment
> routes. (Same gotcha logged in CLAUDE.md for the S3 rollback.)

## Migration

`packages/db/prisma/migrations/20260627000000_phase5_payments` adds
`users.stripe_customer_id`, `payments`, and `subscriptions`. Applied
automatically by the deploy's `migrate deploy`. No data backfill needed.

## Mobile build

1. Set the real `pk_test_…` in `apps/mobile/eas.json` → preview → env →
   `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (currently `pk_test_REPLACE_ME`).
2. Build headlessly:
   ```
   export EXPO_TOKEN=$(cat ~/.config/blubranch/expo-token)
   eas build --platform ios --profile preview --non-interactive --auto-submit --no-wait
   ```
   The Stripe native module is a standard pod — no extra interactive Apple step
   expected (unlike the first Firebase/Push build). If a capability error
   appears, one interactive `eas build` may be needed once.

## Test-mode verification (do before any real money / beta)

- **One-time**: post a Basic/Pro job → Payment Sheet → pay with test card
  `4242 4242 4242 4242` (any future expiry/CVC/zip) → job appears `open`;
  `payments` row `succeeded`; receipt email arrives.
- **3DS**: card `4000 0025 0000 3155` → confirms the authentication sheet path.
- **Decline**: card `4000 0000 0000 0002` → job stays `draft`, no publish.
- **Subscription**: pick Unlimited → Payment Sheet → `4242…` → subsequent posts
  skip payment and go straight to `open`. Check `GET /payments/subscription`
  → `active: true`.
- **Webhook**: confirm 2xx in the Stripe dashboard webhook log; `stripe trigger
  payment_intent.succeeded` for an isolated check. Webhook + the in-app
  `/confirm` call are both idempotent (double-publish is a no-op).
- **Cancel**: `POST /payments/subscription/cancel` → `cancel_at_period_end`
  true; access persists until period end.

## Going live (later, not for beta)

Swap test keys for live (`sk_live_`/`pk_live_`), recreate the Unlimited price +
webhook endpoint in live mode, set `pk_live_…` in the eas.json production
profile, and re-verify with a real card before opening to paying employers.

## App Store note

Selling job postings is a **real-world service** (classified-ad analogue), which
qualifies for external payment under App Review Guideline 3.1.3/3.1.5 — Stripe is
permitted; IAP is not required. Keep the listing copy framed around the
real-world hiring service.
