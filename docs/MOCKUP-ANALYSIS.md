# BluBranch — Mockup analysis

> Source: `BB_Mockups_v1.pdf` — 20 screens, 7 user flows. Color scheme is NOT final.

---

## Screen 1 — Welcome / login

**Purpose:** Entry point. Auth options.

**Elements:**
- BluBranch logo (wrench icon in orange rounded square)
- Tagline: "The professional network built for the Blue Collar."
- "Create a free account" button (orange, primary CTA)
- Social auth: Continue with Apple, Continue with Google, Continue with Facebook
- "Log in to existing account" button (outlined)
- Legal: "By continuing you agree to BluBranch's Terms of Service and Privacy Policy. Workers always free."

**Auth implementation notes:**
- Support email/password + 3 social providers (Apple, Google, Facebook)
- "Workers always free" copy is a key trust signal — surface it prominently
- Need Expo AuthSession or expo-apple-authentication / expo-google-sign-in

---

## Screen 2A — Sign up step 1 of 3: Account

**Fields:**
- First name (text)
- Last name (text)
- Email address (email)
- Phone number (tel) — highlighted in orange border, helper text: "Used for job alerts — never shared publicly"
- Password (password)
- "I am a..." dropdown — options: `Tradesperson / worker`, `Employer / contractor`
  - Helper: "Employers pay to post jobs. Workers are always free."

**Progress indicator:** 3-dot stepper (dot 1 active)
**CTA:** "Continue" (orange)

**Data model implications:**
- `users` table: first_name, last_name, email, phone, password_hash, role (enum: worker | employer | admin)
- Phone is collected at signup (not just verification) — used for job alerts via SMS

---

## Screen 2B — Sign up step 2 of 3: Trade

**Fields:**
- Trade selection (multi-select chip grid): Electrician, Plumber, HVAC/Refrigeration, Carpenter, Welder, Pipefitter, Ironworker, Concrete, Roofer, Trucker/CDL, Heavy Equipment, General Labor
- Years of experience (dropdown): ranges like "6–10 years"
- License / certification # (text, optional) — helper: "Verified licenses display a badge on your profile"
- Union member? (dropdown): e.g. "Yes — IBEW"

**Progress indicator:** 3-dot stepper (dot 2 active)
**CTA:** "Continue" (orange)

**Data model implications:**
- `trades` reference table with the 12 trade categories
- `user_trades` join table (many-to-many — users can have multiple trades)
- `experience_level` enum on worker profile
- `certifications` table: user_id, certification_number, trade, verified (boolean)
- `union_affiliations` table or field on worker profile

---

## Screen 2C — Sign up step 3 of 3: Location

**Fields:**
- City (text)
- State (text)
- Zip code (text)
- "How far will you travel for work?" dropdown: e.g. "Within 25 miles"
- Privacy callout: "Your location is only shown as a city/region on your profile — never your exact address. You control your privacy."
- Job availability (dropdown): e.g. "Open to opportunities"

**Progress indicator:** 3-dot stepper (dot 3 active)
**CTA:** "Create my BluBranch profile" (dark blue)
**Helper:** "Takes about 30 seconds to finish your profile"

**Data model implications:**
- `worker_profiles`: city, state, zip_code, travel_radius_miles, job_availability (enum: open | not_looking | actively_looking)
- Need to geocode zip code → lat/lng for PostGIS queries
- Privacy: never expose exact address, only city/region

---

## Screen 3A — Profile creation step 1 of 4: Photo & bio

**Fields:**
- Profile photo upload (avatar with initials fallback + camera icon)
- Display: "Mike Rodriguez — Electrician · Chicago, IL"
- Profile headline (text, 1 line): e.g. "Journeyman Electrician · IBEW Local 134" — helper: "Shown under your name on every post and in search results"
- About me (textarea, optional but recommended, 300 char limit with counter)
- Trade (pre-filled from signup)
- Experience (pre-filled from signup)
- Union / affiliation (text, optional): helper: "Displayed as a badge on your posts and profile"

**Progress:** 4-dot stepper (dot 1 active)
**CTAs:** "Save & continue" (orange) + "Skip for now" (text link)

**Data model:**
- `worker_profiles`: headline, bio (varchar 300), profile_photo_url
- Profile photo stored in cloud storage (S3/Cloudflare R2)

---

## Screen 3B — Profile creation step 2 of 4: Skills & certs

**Fields:**
- Top skills (multi-select chip grid, max 8): Panel upgrades, Commercial wiring, Service calls, New construction, Conduit bending, Low voltage, EV charger install, Troubleshooting, Motor controls, Blueprint reading, Solar/PV, Generator systems
- Licenses & certifications section:
  - Listed cert: "IL Journeyman Electrician License #IL-EL-2291847" with "Verified" badge
  - "+ Add another license or certification" button
- Hourly rate (number, optional): helper: "shown only to employers"

**Data model:**
- `skills` reference table
- `user_skills` join table (max 8 per user)
- `certifications` table: name, number, verified, verified_at
- `worker_profiles`: hourly_rate (decimal, nullable), show_hourly_rate (boolean)

---

## Screen 3C — Profile creation step 3 of 4: Work photos

**Fields:**
- Portfolio photos grid (up to 12): labeled thumbnails (e.g. "Panel upgrade", "Conduit run", "New construction")
- Callout: "Profiles with job photos get 3x more connection requests and employer views. Show your craft."
- Work history:
  - Entry: "Apex Electric Co. — Journeyman Electrician · 2019 – Present"
  - "+ Add a previous employer" button

**Data model:**
- `portfolio_photos` table: user_id, photo_url, caption, sort_order (max 12)
- `work_history` table: user_id, company_name, title, start_date, end_date (null = present), is_current

---

## Screen 3D — Profile creation step 4 of 4: Privacy & visibility

**Toggle settings:**
- Open to work (default ON): "Employers in your area can see you're available"
- Show hourly rate (default OFF): "Only visible to employers, not other workers"
- Show union affiliation (default ON): "Displayed as a badge on your posts and profile"
- Financial wellness tips (default ON): "Receive trade-specific money and tax content in your feed"
- Job alerts (default ON): "Push notifications for new jobs matching your trade & location"

**Callout:** "Your profile is ready. You can update any of these settings anytime from your profile page."
**CTA:** "Take me to my feed" (dark blue)

**Data model:**
- `user_settings` table or JSON column: open_to_work, show_hourly_rate, show_union, financial_tips, job_alerts

---

## Screen 4 — Home feed

**Header bar:** BluBranch logo + notification bell (with badge) + message icon + user avatar
**Search bar:** "Trade, keyword, or company..." with location pill "Chicago, IL"

**Feed content (mixed):**
1. **Social post card:**
   - User avatar + name + trade + location + timestamp + trade badge (e.g. "IBEW")
   - Photo placeholder
   - Post text
   - Engagement: thumbs-up count, comment count, share button

2. **Job card (inline in feed):**
   - Section header: "JOBS NEAR YOU"
   - Job title + company + location
   - Pay rate (orange): "$42/hr"
   - Description snippet
   - Tags: Commercial, Full-time, Benefits, distance ("4.2 mi away" in orange)
   - "Quick Apply" button (orange)

3. **Another social post** (different user/trade)

**Bottom tabs:** Feed (active), Finances ($), Post (+, orange circle), Jobs (briefcase), Profile (person)

**Data model:**
- `posts` table: user_id, content, created_at
- `post_photos` table: post_id, photo_url, sort_order
- `post_likes` table: post_id, user_id
- `post_comments` table: post_id, user_id, content, created_at
- Feed algorithm: mix of social posts from connections + nearby job listings

---

## Screen 5A — Worker profile: About tab

**Profile header (dark navy background):**
- Avatar (large, with green online dot)
- Name: "Mike Rodriguez"
- Headline: "Journeyman Electrician · 8 Years Experience"
- Location: "Chicago, IL · Within 25 miles"
- Badges: "IBEW Local 134" | "✓ IL Licensed" (green) | "Open to Work"

**Stats row:** 312 Connections | 47 Posts | 4.9 Rating | 8 Endorsements

**Action buttons:** "Connect" (orange) | "Message" (outlined) | Share icon

**Tab bar:** About (active) | Portfolio | Posts

**About tab content:**
- About section (bio text)
- Skills (chip tags)
- Licenses & certifications (with verified badges)
- Work history (timeline with current/past employers)

---

## Screen 5B — Worker profile: Portfolio tab

Same header as 5A.

**Portfolio grid:** Masonry-style layout with captioned work photos (e.g. "200A Panel Upgrade · Lincoln Park", "Conduit run", "New build", "Service call", "EV charger", "Breaker panel")

**Endorsements section:**
- Endorsement cards with avatar + name + title + quote

---

## Screen 5C — Worker profile: Posts tab

Same header as 5A.

**Posts:** Feed-style list of user's own posts with engagement counts.

---

## Screen 6A — Job board

**Header:** BluBranch logo + filter icon + notification bell
**Search bar:** "Trade, keyword, or company..." + location pill
**Trade filter pills:** All trades (orange, active), Electrician, Plumber, HVAC, Carpenter (scrollable)

**Results:** "148 jobs near Chicago, IL" + sort dropdown "Nearest first"

**Featured section:**
- Featured job card (orange border/header):
  - "FEATURED" badge
  - Company avatar + name + location
  - Job title
  - Pay range (orange): "$42–$48 / hr"
  - Tags: Full-time, Commercial, Benefits, Urgent (red)
  - Distance: "4.2 mi away" (orange)
  - Bookmark icon
  - "Quick Apply" button

**Near you section:**
- Standard job cards (no featured styling, same content structure)

---

## Screen 6B — Job detail

**Header:** "Job details" + bookmark icon

**Employer info:** Company avatar + name + location + distance

**Job info:**
- Title: "Journeyman Electrician"
- Pay: "$42–$48 / hr" (orange)
- Tags: Full-time, Commercial, Benefits, Urgent hire (red)
- Distance badge

**Stats row:** 47 Applicants | 2h Posted | 3 Openings | 4.8 Employer rating

**Sections:**
- About the role (text description)
- What you need (bulleted requirements list)
- Benefits (icon + label chips): Health insurance, Paid OT after 40hr, Union eligible, Paid holidays
- About the employer: Company card with size, year established, rating, "View company profile" link

**Sticky footer:** "Quick Apply" button + bookmark icon

**Data model:**
- `jobs` table: employer_id, title, trade, experience_level, pay_min, pay_max, job_type (enum), work_setting (enum), location (PostGIS geography), city, state, zip, description, openings_count, status (enum: draft | open | closed | expired), is_featured, is_urgent, boost_push_notification, boost_featured_placement, plan_tier, created_at, expires_at
- `job_benefits` join table
- `benefits` reference table
- `job_requirements` table or JSON array
- `job_applications` table: job_id, worker_id, status (enum: applied | reviewed | shortlisted | hired | rejected), applied_at

---

## Screen 7A — Employer posting step 1 of 6: Choose plan

**Three pricing tiers:**

| Plan | Price | Features |
|------|-------|----------|
| Basic | $49/post | Listed in local feed, Quick Apply, applicant dashboard. No featured, no urgent badge. |
| Pro (most popular) | $129/post | Featured top placement, urgent badge, push alert to matching workers, 60-day listing, applicant analytics |
| Unlimited | $299/month | Unlimited posts, all Pro features, company profile page, direct message applicants, priority support |

**CTA:** "Continue with Pro — $129"
**Helper:** "30-day money back guarantee · Cancel anytime"

**Data model:**
- `employer_subscriptions` table for Unlimited plan (Stripe subscription)
- `job_posts` or field on jobs table for per-post purchases (Stripe one-time payment)
- `plan_tier` enum: basic | pro | unlimited

---

## Screen 7B — Employer posting step 2 of 6: Company info

**Fields:**
- Company name (text)
- Industry / trade (text/dropdown)
- Company size (dropdown): e.g. "11–50 employees"
- Company website (text, optional)
- About your company (textarea, 300 char limit)
- Contact email for applicants (email) — helper: "Not shown publicly — used to deliver applicant notifications"

**Data model:**
- `companies` table: name, industry, size_range, website, description, contact_email, employer_id
- Companies are reusable across multiple job posts by the same employer

---

## Screen 7C — Employer posting step 3 of 6: Job details

**Fields:**
- Job title (text)
- Trade required (dropdown)
- Experience level (dropdown): e.g. "Journeyman (4–10 yrs)"
- Pay min / Pay max (currency inputs): "$ / hr"
- Job type (single-select chips): Full-time, Part-time, Contract, Temp-to-hire
- Work setting (single-select chips): Commercial, Residential, Industrial, Mixed
- Job location (text with geocoding)
- Number of openings (dropdown)
- Job description (textarea, 1000 char limit)

---

## Screen 7D — Employer posting step 4 of 6: Perks & boosts

**Benefits offered (multi-select chips):** Health insurance, Paid OT after 40hr, Paid holidays, Dental & vision, 401(k)/pension, Per diem, Union eligible, Tool allowance, Relocation assist

**Listing boosts (toggles, included with Pro plan):**
- Urgent hire badge (ON) — "Red badge drives 2x more applicants"
- Push notification blast (ON) — "Alert all matching workers in your area"
- Featured top placement (ON) — "Pin your post to the top of local results"
- Boost to saved workers (OFF) — "Upgrade to Unlimited to unlock"

---

## Screen 7E — Employer posting step 5 of 6: Review & publish

**Summary table:** Job title, company, trade, pay range, job type, location, openings

**Boosts active table:** Urgent badge, push blast, featured placement, listing duration (60 days)

**Pricing card:** "Pro post — All boosts included · 60 days — $129 one-time"

**Legal:** "By publishing you agree to BluBranch's Employer Terms. No refunds after job goes live."

**CTA:** "Pay $129 & publish job" (dark blue)
**Secondary:** "Go back and edit" (text link)

---

## Screen 7F — Employer posting step 6 of 6: Job live!

**Confirmation:**
- Success icon (green checkmark)
- "Your job is live"
- "Journeyman Electrician at Apex Electric Co. is now visible to tradespeople in the Chicago area. Push alerts have been sent to 312 matching workers."

**Estimated reach card:** 312 Workers notified | ~40 Expected views | ~12 Est. applicants

**CTAs:** "Post another job" (orange) | "View applicant dashboard" (dark blue)

---

## Navigation structure (bottom tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Feed | House | Home feed (Screen 4) |
| Finances | $ | Financial wellness / earnings (not mocked yet) |
| Post | + (orange circle) | Create post flow |
| Jobs | Briefcase | Job board (Screen 6A) |
| Profile | Person | Worker profile (Screen 5A) |
