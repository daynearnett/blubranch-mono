# Phase 4 — TestFlight test checklist (messaging, push, SMS gate)

> For Anthony + Balint to run on real iPhones once the Phase 4 build is in
> TestFlight **and** the staging API (`api-staging.blubranch.com`) has Phase 4
> deployed. Most of this needs **two devices signed in as two different users**.

## Setup (do this first)
- [ ] Both testers install the new TestFlight build (must be the Phase 4 build — version/build newer than the current one; it's the first build with push).
- [ ] Tester A and Tester B each sign in as **different** accounts.
- [ ] The two accounts are **connected** (accept a connection request between them) — several features are connection-gated.
- [ ] For the application-status push test, you'll also want one **employer** account with a posted job and one **worker** account that applies.
- [ ] On first launch, confirm the **push-permission prompt** appears; tap **Allow**. (If you tapped "Don't Allow" earlier, enable it in iOS Settings → BluBranch → Notifications.)

## 1. Messaging — real-time (two devices, side by side)
- [ ] Open the **messages** icon (top-right search bar) → conversations list loads.
- [ ] From **Network → Connections**, tap a connection's **quick-message** button → opens a new chat.
- [ ] A sends a message → **B sees it appear within ~1s without refreshing**.
- [ ] B replies → A sees it instantly.
- [ ] While A is typing, **B sees the "typing…" indicator**; it clears when A stops/sends.
- [ ] After B opens the thread, **A's messages show as read** (read receipt).
- [ ] **Unread badge**: when B is NOT in the chat, B's messages icon + conversation row show an unread count; opening the chat clears it.
- [ ] Send ~30+ messages, then scroll up in the thread → **older messages page in** (cursor pagination).
- [ ] Kill the app and reopen → conversation history persists and loads.

## 2. Push notifications (background + foreground)
- [ ] **New message while backgrounded**: B backgrounds the app; A sends a message → **B gets a push** with A's name + preview. Tapping it opens the app (ideally to that chat).
- [ ] **Foreground message**: B has the app open (but not in that chat); A sends → B sees an in-app notification banner.
- [ ] **Connection request**: A sends B a connection request → **B gets a push**.
- [ ] **Connection accepted**: B accepts → **A gets a push**.
- [ ] **Application status**: employer moves a worker's application to shortlisted/hired → **worker gets a push**.
- [ ] **Preference gating**: in Settings → notifications, turn **off** message notifications → send a message → **no push** arrives (in-app message still works).

## 3. SMS apply-gate (Twilio)
- [ ] As a worker who has **not** verified a phone number, tap **Quick Apply** on a job → app routes to the **verify-phone** screen (not the application).
- [ ] Enter a real phone number → receive the **6-digit SMS code** (Twilio) → enter it → verification succeeds → the apply flow continues.
- [ ] Re-apply to another job → **no phone prompt** this time (already verified).

## 4. Presence (only if Redis is wired on staging)
- [ ] When both testers are online, an **online indicator** shows on the other's conversation/connection (degrades silently if Redis isn't connected — not a blocker).

## 5. Regression sanity (make sure 3.5 still works)
- [ ] Feed loads; posting still works.
- [ ] Jobs board + job detail + apply (for an already-verified account) work.
- [ ] Profile, Network tabs load normally.

## How to report issues
For each failure note: **which tester/account**, **iPhone model + iOS version**, **what you did**, **what happened vs. expected**, and a screenshot. File as a CR per `docs/CR-HANDLING.md`.

## Known/expected
- First push can take a few seconds.
- If push never arrives: confirm notification permission is granted, the device registered a token (staging API log: `POST /devices/register`), and Firebase env vars are set on Railway.
- Presence + job-match digests depend on Redis being wired on staging (`REDIS_URL`).
