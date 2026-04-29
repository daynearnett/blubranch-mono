# BluBranch — Data model

> Derived from mockup analysis. This is the target schema for Prisma.

## Entity relationship summary

```
users ──┬── worker_profiles ──┬── user_trades (→ trades)
        │                     ├── user_skills (→ skills)
        │                     ├── certifications
        │                     ├── portfolio_photos
        │                     ├── work_history
        │                     └── user_settings
        │
        ├── employer_profiles ── companies
        │
        ├── posts ──┬── post_photos
        │           ├── post_likes
        │           └── post_comments
        │
        ├── connections (self-referential)
        ├── endorsements
        ├── conversations ── messages
        │
        └── jobs ──┬── job_benefits (→ benefits)
                   ├── job_applications
                   └── job_requirements
```

## Core tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| first_name | varchar(100) | |
| last_name | varchar(100) | |
| email | varchar(255) | unique |
| phone | varchar(20) | unique, used for SMS alerts |
| password_hash | varchar(255) | nullable if social auth only |
| role | enum(worker, employer, admin) | |
| auth_provider | enum(email, apple, google, facebook) | |
| auth_provider_id | varchar(255) | nullable |
| profile_photo_url | varchar(500) | nullable |
| is_verified | boolean | default false |
| created_at | timestamp | |
| updated_at | timestamp | |

### worker_profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, unique |
| headline | varchar(200) | e.g. "Journeyman Electrician · IBEW Local 134" |
| bio | varchar(300) | "About me" section |
| experience_level | enum(0-2, 3-5, 6-10, 11-15, 16-20, 20+) | |
| hourly_rate | decimal(8,2) | nullable |
| city | varchar(100) | |
| state | varchar(50) | |
| zip_code | varchar(10) | |
| location | geography(Point) | PostGIS — geocoded from zip |
| travel_radius_miles | integer | e.g. 25 |
| job_availability | enum(open, actively_looking, not_looking) | |
| union_name | varchar(200) | nullable, e.g. "IBEW Local 134" |
| created_at | timestamp | |
| updated_at | timestamp | |

### user_settings
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK → users, PK |
| open_to_work | boolean | default true |
| show_hourly_rate | boolean | default false |
| show_union | boolean | default true |
| financial_tips | boolean | default true |
| job_alerts | boolean | default true |

### trades (reference table)
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| name | varchar(100) | unique |
| slug | varchar(100) | unique, URL-safe |

**Seed data:** Electrician, Plumber, HVAC/Refrigeration, Carpenter, Welder, Pipefitter, Ironworker, Concrete, Roofer, Trucker/CDL, Heavy Equipment, General Labor

### user_trades (join)
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK → users |
| trade_id | integer | FK → trades |
| (composite PK) | | |

### skills (reference table)
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| name | varchar(100) | |
| trade_id | integer | FK → trades, nullable (some skills are cross-trade) |

### user_skills (join, max 8)
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK → users |
| skill_id | integer | FK → skills |
| (composite PK) | | |

### certifications
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | varchar(200) | e.g. "IL Journeyman Electrician License" |
| certification_number | varchar(100) | e.g. "IL-EL-2291847" |
| is_verified | boolean | default false |
| verified_at | timestamp | nullable |

### portfolio_photos (max 12)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| photo_url | varchar(500) | |
| caption | varchar(100) | e.g. "Panel upgrade" |
| sort_order | integer | |

### work_history
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| company_name | varchar(200) | |
| title | varchar(200) | |
| start_date | date | |
| end_date | date | nullable (null = current) |
| is_current | boolean | |

### companies
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| employer_id | uuid | FK → users (role=employer) |
| name | varchar(200) | |
| industry | varchar(100) | |
| size_range | enum(1-10, 11-50, 51-200, 201-500, 500+) | |
| website | varchar(500) | nullable |
| description | varchar(300) | |
| contact_email | varchar(255) | not public |
| logo_url | varchar(500) | nullable |
| established_year | integer | nullable |
| rating | decimal(3,2) | computed |
| created_at | timestamp | |

### jobs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| employer_id | uuid | FK → users |
| company_id | uuid | FK → companies |
| title | varchar(200) | |
| trade_id | integer | FK → trades |
| experience_level | varchar(50) | e.g. "Journeyman (4–10 yrs)" |
| pay_min | decimal(8,2) | hourly |
| pay_max | decimal(8,2) | hourly |
| job_type | enum(full_time, part_time, contract, temp_to_hire) | |
| work_setting | enum(commercial, residential, industrial, mixed) | |
| location | geography(Point) | PostGIS |
| city | varchar(100) | |
| state | varchar(50) | |
| zip_code | varchar(10) | |
| description | varchar(1000) | |
| openings_count | integer | default 1 |
| status | enum(draft, open, closed, expired) | |
| plan_tier | enum(basic, pro, unlimited) | |
| is_featured | boolean | default false |
| is_urgent | boolean | default false |
| boost_push_notification | boolean | default false |
| boost_featured_placement | boolean | default false |
| stripe_payment_id | varchar(255) | nullable |
| created_at | timestamp | |
| expires_at | timestamp | 30 or 60 days from creation |

### benefits (reference table)
Seed: Health insurance, Paid OT after 40hr, Paid holidays, Dental & vision, 401(k)/pension, Per diem, Union eligible, Tool allowance, Relocation assist

### job_benefits (join)
| Column | Type |
|--------|------|
| job_id | uuid FK |
| benefit_id | integer FK |

### job_applications
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| job_id | uuid | FK → jobs |
| worker_id | uuid | FK → users |
| status | enum(applied, reviewed, shortlisted, hired, rejected) | |
| message | text | optional cover message |
| applied_at | timestamp | |

### posts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| content | text | |
| created_at | timestamp | |

### post_photos, post_likes, post_comments
Standard social feed tables.

### connections
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| requester_id | uuid | FK → users |
| receiver_id | uuid | FK → users |
| status | enum(pending, accepted, declined) | |
| created_at | timestamp | |

### endorsements
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| endorser_id | uuid | FK → users |
| endorsed_id | uuid | FK → users |
| endorser_title | varchar(200) | e.g. "Foreman, Apex Electric" |
| content | varchar(500) | quote text |
| created_at | timestamp | |

### conversations & messages
Standard messaging tables with Socket.io real-time delivery.
