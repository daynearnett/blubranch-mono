// BluBranch legal documents — canonical source shared by the API (rendered as
// HTML at /legal/*) and the mobile app (rendered as native screens).
//
// ⚠️ TEMPLATE — NOT LEGAL ADVICE. These drafts describe BluBranch's actual data
// practices as built (accounts, location, photos, SMS, email, payments, social
// sign-in, push, moderation) but MUST be reviewed by qualified legal counsel
// before public launch. Update `effectiveDate`/`version` when the text changes.

export interface LegalSection {
  heading: string;
  /** Paragraphs. A line beginning with "• " renders as a bullet list item. */
  body: string[];
}

export interface LegalDocument {
  slug: 'privacy' | 'terms';
  title: string;
  version: string;
  effectiveDate: string; // ISO date
  /** Shown in a prominent banner — remove once counsel-reviewed & finalized. */
  draftBanner: string;
  intro: string[];
  sections: LegalSection[];
}

const EFFECTIVE_DATE = '2026-07-05';
const VERSION = '1.0-draft';
const CONTACT_EMAIL = 'privacy@blubranch.com';
const DRAFT_BANNER =
  'DRAFT for review — this document has not yet been reviewed by legal counsel and is not final. It describes BluBranch’s current data and service practices for internal review purposes.';

export const privacyPolicy: LegalDocument = {
  slug: 'privacy',
  title: 'BluBranch Privacy Policy',
  version: VERSION,
  effectiveDate: EFFECTIVE_DATE,
  draftBanner: DRAFT_BANNER,
  intro: [
    'BluBranch, Inc. ("BluBranch," "we," "us," or "our") operates the BluBranch professional networking and job marketplace platform for skilled trades and blue-collar workers (the "Service"). This Privacy Policy explains what information we collect, how we use and share it, and the choices you have.',
    'By creating an account or using the Service, you agree to the collection and use of information as described here. If you do not agree, please do not use the Service.',
  ],
  sections: [
    {
      heading: '1. Information You Provide to Us',
      body: [
        'Account information: your name, email address, phone number, and password (stored only as a secure hash). If you sign in with Apple or Google, we receive a verified email address, a unique identifier, and (on first sign-in) your name from that provider.',
        'Worker profile: your trade(s), skills, years of experience, work history, license and certification details, union affiliation, headline and bio, city/state/ZIP, travel radius, pay expectations, and profile and portfolio photos.',
        'Employer/company information: company name, size, contact details, and the content of job postings you create.',
        'Content you create: posts, comments, direct messages, job applications, connection requests, reports, and any photos you upload. Photos are stripped of embedded location (EXIF) metadata on upload.',
        'Payment information: when an employer pays for a plan, payment card details are collected and processed directly by our payment processor (Stripe). BluBranch does not receive or store full card numbers.',
      ],
    },
    {
      heading: '2. Information We Collect Automatically',
      body: [
        'Location: we use the city, state, and ZIP you provide (and, with your permission, your device location) to show jobs near you and set your profile’s region. We geocode this to approximate coordinates for distance-based matching. We do not publish your precise location — only your city and region are shown to others.',
        'Usage and device data: we collect log data, device identifiers, a push-notification token (if you enable notifications), and analytics such as which job postings are viewed and searches performed, to operate and improve the Service.',
        'Cookies and similar technologies may be used on our web properties to keep you signed in and understand usage.',
      ],
    },
    {
      heading: '3. How We Use Your Information',
      body: [
        '• To create and manage your account and profile.',
        '• To match workers with relevant jobs and employers with relevant candidates.',
        '• To enable posts, connections, messaging, applications, and other core features.',
        '• To verify your phone number by SMS and your email address, and to prevent fraud and abuse.',
        '• To process employer payments and manage subscriptions.',
        '• To send you notifications (in-app, push, email, and SMS) about activity relevant to you, subject to your preferences.',
        '• To moderate content for safety, including automated screening of text and images for explicit or violent material.',
        '• To comply with legal obligations and enforce our Terms.',
      ],
    },
    {
      heading: '4. How We Share Your Information',
      body: [
        'With other users: your profile, posts, job postings, and public activity are visible to other users as designed (for example, a "connections-only" post is limited to your accepted connections). Employers can see the profiles of workers who apply to their jobs.',
        'With service providers who process data on our behalf, including: Stripe (payments), Twilio (SMS verification), Resend (email delivery), Google Firebase (push notifications), Amazon Web Services (image storage and hosting), OpenAI (automated content moderation), and Google Maps (geocoding). These providers may only use your information to provide services to us.',
        'For legal reasons: to comply with law, respond to lawful requests, protect the rights, property, and safety of BluBranch, our users, and the public, and to enforce our Terms.',
        'In a business transfer: if BluBranch is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.',
        'We do not sell your personal information for money.',
      ],
    },
    {
      heading: '5. Data Retention',
      body: [
        'We keep your information for as long as your account is active and as needed to provide the Service. We retain and use information as necessary to comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we delete or de-identify your personal information within a reasonable period, except where retention is required by law.',
      ],
    },
    {
      heading: '6. Your Rights and Choices',
      body: [
        '• Access and update: you can view and edit most profile information in the app.',
        '• Deletion: you can request deletion of your account and personal information by contacting us.',
        '• Location: you can disable device-location permission at any time in your device settings; the Service remains usable with the region you enter manually.',
        '• Notifications: you can control push, email, and SMS notifications in your settings and device controls. You may reply STOP to opt out of non-essential SMS.',
        '• Depending on where you live (for example, California or the EU/UK), you may have additional rights to access, correct, delete, or port your data, and to object to certain processing. Contact us to exercise these rights.',
      ],
    },
    {
      heading: '7. Security',
      body: [
        'We use technical and organizational measures to protect your information, including encryption in transit, hashed passwords, verified-token social sign-in, and access controls. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
      ],
    },
    {
      heading: '8. Children’s Privacy',
      body: [
        'The Service is intended for users who are at least 18 years old. We do not knowingly collect personal information from anyone under 18. If you believe a minor has provided us information, please contact us and we will delete it.',
      ],
    },
    {
      heading: '9. SMS Messaging',
      body: [
        'When you verify your phone number, you consent to receive an SMS verification code and account-related text messages. Message and data rates may apply. Message frequency varies. Reply STOP to opt out of non-essential messages and HELP for help.',
      ],
    },
    {
      heading: '10. Changes to This Policy',
      body: [
        'We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date and, where appropriate, notify you in the app. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.',
      ],
    },
    {
      heading: '11. Contact Us',
      body: [
        `If you have questions about this Privacy Policy or your information, contact us at ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  slug: 'terms',
  title: 'BluBranch Terms of Service',
  version: VERSION,
  effectiveDate: EFFECTIVE_DATE,
  draftBanner: DRAFT_BANNER,
  intro: [
    'These Terms of Service ("Terms") govern your access to and use of the BluBranch platform and services (the "Service") provided by BluBranch, Inc. ("BluBranch," "we," "us," or "our"). By creating an account or using the Service, you agree to these Terms and to our Privacy Policy.',
  ],
  sections: [
    {
      heading: '1. Eligibility and Accounts',
      body: [
        'You must be at least 18 years old and able to form a binding contract to use the Service. You agree to provide accurate information, keep your account credentials secure, and are responsible for all activity under your account. Notify us promptly of any unauthorized use.',
      ],
    },
    {
      heading: '2. The Service — A Platform, Not an Employer',
      body: [
        'BluBranch is a marketplace and networking platform that connects skilled workers with employers and contractors. BluBranch is not an employer, staffing agency, or party to any employment, contracting, or other relationship between users. We do not guarantee that any job will be filled, that any worker will be hired, or that any posting, profile, license, or credential is accurate.',
        'You are solely responsible for your interactions and agreements with other users, including verifying qualifications, licensing, insurance, work eligibility, and the terms of any engagement. We encourage appropriate diligence, including background and reference checks, where relevant.',
      ],
    },
    {
      heading: '3. Worker and Employer Roles; Fees',
      body: [
        'Workers use the core networking and job-search features at no charge.',
        'Employers pay to post jobs and access certain hiring features. Current plans are: Basic ($19 per job post), Blu ($79 per month), and Blu Max ($139 per month). Plan features and prices are shown at the time of purchase and may change on a prospective basis.',
        'Paid job posts become active only after payment is successfully processed; subscription features require an active subscription.',
      ],
    },
    {
      heading: '4. Payments, Subscriptions, and Refunds',
      body: [
        'Payments are processed by our payment processor, Stripe. By purchasing, you authorize us and Stripe to charge your selected payment method for the applicable fees and any taxes.',
        'Subscriptions renew automatically at the end of each billing period until cancelled. You can cancel at any time in the app; cancellation takes effect at the end of the current billing period, and you retain access until then.',
        'Except where required by law, fees are non-refundable. We may change fees prospectively with notice.',
      ],
    },
    {
      heading: '5. Your Content and License',
      body: [
        'You retain ownership of the content you submit (profiles, posts, photos, messages, job postings). You grant BluBranch a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, and distribute your content as necessary to operate and promote the Service, consistent with your visibility settings.',
        'You represent that you have the rights to the content you submit and that it does not infringe others’ rights or violate any law.',
      ],
    },
    {
      heading: '6. Acceptable Use',
      body: [
        'You agree not to:',
        '• Post false, misleading, discriminatory, harassing, hateful, sexually explicit, violent, or otherwise unlawful content.',
        '• Impersonate others or misrepresent your identity, credentials, or affiliation.',
        '• Post discriminatory job requirements or otherwise violate applicable employment, labor, or anti-discrimination laws.',
        '• Harvest or scrape data, send spam, or use the Service to solicit users for unrelated purposes.',
        '• Interfere with, disrupt, or attempt to gain unauthorized access to the Service or other accounts.',
      ],
    },
    {
      heading: '7. Content Moderation and Reporting',
      body: [
        'We may screen, review, remove, or restrict content and accounts that we believe violate these Terms or applicable law, including through automated moderation of text and images. You can report content or users in the app, and we may act on reports at our discretion. We are not obligated to monitor all content and are not responsible for user content.',
      ],
    },
    {
      heading: '8. Intellectual Property',
      body: [
        'The Service, including its software, design, and trademarks, is owned by BluBranch and protected by law. We grant you a limited, non-exclusive, non-transferable license to use the Service for its intended purpose. You may not copy, modify, distribute, or reverse-engineer the Service except as permitted by law.',
      ],
    },
    {
      heading: '9. Third-Party Services',
      body: [
        'The Service integrates third-party services (for example, Apple and Google sign-in, Stripe, maps). Your use of those features may be subject to the third party’s terms and privacy policies. We are not responsible for third-party services.',
      ],
    },
    {
      heading: '10. Disclaimers',
      body: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY JOB, CANDIDATE, OR USER CONTENT WILL MEET YOUR EXPECTATIONS.',
      ],
    },
    {
      heading: '11. Limitation of Liability',
      body: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, BLUBRANCH AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR ONE HUNDRED U.S. DOLLARS ($100).',
      ],
    },
    {
      heading: '12. Indemnification',
      body: [
        'You agree to indemnify and hold BluBranch harmless from claims, damages, and expenses (including reasonable attorneys’ fees) arising from your content, your use of the Service, your dealings with other users, or your violation of these Terms or any law.',
      ],
    },
    {
      heading: '13. Termination',
      body: [
        'You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you violate these Terms or to protect the Service or other users. Provisions that by their nature should survive termination will survive.',
      ],
    },
    {
      heading: '14. Governing Law and Disputes',
      body: [
        'These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-laws rules. Any disputes will be resolved in the state or federal courts located in Delaware, unless otherwise required by applicable law. You and BluBranch agree to first attempt to resolve disputes informally by contacting us.',
      ],
    },
    {
      heading: '15. Changes to These Terms',
      body: [
        'We may update these Terms from time to time. When we make material changes, we will update the effective date and, where appropriate, notify you in the app. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.',
      ],
    },
    {
      heading: '16. Contact Us',
      body: [`Questions about these Terms? Contact us at ${CONTACT_EMAIL}.`],
    },
  ],
};

export const legalDocuments: Record<'privacy' | 'terms', LegalDocument> = {
  privacy: privacyPolicy,
  terms: termsOfService,
};
