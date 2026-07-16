# App Store Connect — ready-to-paste metadata

Final copy for the BluBranch App Store listing. Paste into App Store Connect →
the version. Character limits noted. Pairs with [APP-STORE-SUBMISSION.md](APP-STORE-SUBMISSION.md).

## Name (30 max)
```
BluBranch
```

## Subtitle (30 max)
```
Jobs & network for the trades
```

## Promotional text (170 max — updatable without review)
```
Find local trade jobs, build your professional network, and get hired. Free for workers.
```

## Keywords (100 max, comma-separated, no spaces after commas)
```
trades,jobs,blue collar,electrician,plumber,contractor,hiring,network,skilled,construction,HVAC,welder
```

## Description (4000 max)
```
BluBranch is the professional network built for the blue collar — skilled tradespeople, contractors, and the employers who hire them.

FOR WORKERS — always free
• Build a profile that showcases your trade, skills, licenses, and work history
• Find local jobs matched to your trade, experience, and location — apply in one tap
• Connect with other tradespeople, get endorsements, and grow your reputation
• Get verified: license verification and workplace confirmation build trust
• Share your work and milestones on a feed built for the trades

FOR EMPLOYERS & CONTRACTORS
• Post jobs and reach qualified local workers in your trade
• Review applicants and message candidates directly
• Simple plans: pay per post or subscribe for ongoing hiring

Whether you're a journeyman electrician looking for your next job, a plumber growing your network, or a contractor trying to fill a crew — BluBranch connects the people who build things.

Workers always free. Join the network built for the trades.
```

## What's New (for this version, 4000 max)
```
Welcome to BluBranch! Create your profile, find local trade jobs, connect with other pros, and get hired. Sign in with Apple, Google, or email.
```

## Category
- Primary: **Business**
- Secondary (optional): **Networking** *(if the account supports a secondary)*

## Support URL
```
https://api.blubranch.com/support
```
*(A simple support page served by the API — contact + basics. Swap for blubranch.com once the marketing site is live.)*

## Marketing URL (optional)
Leave blank, or `https://blubranch.com` once it's no longer the under-construction page.

## Copyright
```
© 2026 BluBranch, Inc.
```

## Age rating
Complete the questionnaire → expect **4+**. Note user-generated content is
moderated (auto text+image moderation + report/block) — mention in review notes.

## App Privacy (nutrition label)
See [APP-STORE-SUBMISSION.md §3](APP-STORE-SUBMISSION.md) — declare: Contact Info
(name/email/phone), Coarse Location, User Content (photos/posts/messages),
Identifiers (user id, device/push token), Payment Info (via Stripe), Usage Data
(analytics). **Tracking: No** (no cross-app ad tracking → no ATT). Privacy Policy
URL: `https://api.blubranch.com/legal/privacy`.

## App Review Information (notes to the reviewer)
```
BluBranch is a two-sided marketplace for skilled trades. Workers use the app for free.

Demo account (worker):
  Email: <demo email>
  Password: <demo password>

Sign in with the email/password above (Apple/Google sign-in require your own
accounts). The demo worker can browse the feed, search and view jobs, apply to a
job, edit their profile, and message. User-generated content is auto-moderated and
users can report/block. Employer job-posting uses Stripe in test mode for this
review build; the free worker experience covers the core flows.
```
*(Fill the demo email/password from the account we provision on prod.)*
