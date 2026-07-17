/**
 * Seed demo content for screenshots + App Store review: a hiring company with
 * several open jobs, a few workers with filled profiles + feed posts, and a
 * demo worker account (login for the reviewer / screenshots).
 *
 * Writes directly via Prisma (bypasses the Stripe payment gate so jobs are
 * `open`). Idempotent by email. Run inside a Railway container:
 *   DEMO_EMAIL=demo@blubranch.com DEMO_PASSWORD='...' \
 *     pnpm --filter @blubranch/api exec tsx scripts/seed-demo.ts
 */
import { getPrisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/auth/password.js';

const prisma = getPrisma();
const TERMS = '1.0';

const TRADE = { electrician: 1, plumber: 2, hvac: 3, carpenter: 4, welder: 5, ironworker: 7 };

async function ensureUser(opts: {
  email: string; firstName: string; lastName: string; role: 'worker' | 'employer';
  password?: string; profile?: Record<string, unknown>;
}) {
  const email = opts.email.toLowerCase();
  const passwordHash = await hashPassword(opts.password ?? 'Demo-seed-pass-123!');
  const base = {
    firstName: opts.firstName, lastName: opts.lastName, email, passwordHash,
    role: opts.role, authProvider: 'email' as const, emailVerified: true,
    termsAcceptedAt: new Date(), termsVersion: TERMS,
  };
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: base })
    : await prisma.user.create({
        data: {
          ...base,
          ...(opts.role === 'worker' ? { settings: { create: {} } } : {}),
        },
      });
  if (opts.role === 'worker') {
    await prisma.workerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id, experienceLevel: 'years_3_5', city: 'Chicago', state: 'IL',
        zipCode: '60601', travelRadiusMiles: 30, jobAvailability: 'open',
        ...(opts.profile ?? {}),
      },
      update: opts.profile ?? {},
    });
  }
  return user;
}

async function ensureJob(employerId: string, companyId: string, j: {
  title: string; tradeId: number; payMin: number; payMax: number; city: string; state: string;
  zip: string; description: string; jobType?: string; featured?: boolean;
}) {
  const found = await prisma.job.findFirst({ where: { employerId, title: j.title } });
  if (found) return found;
  return prisma.job.create({
    data: {
      employerId, companyId, title: j.title, tradeId: j.tradeId, tradeIds: [j.tradeId],
      experienceLevel: 'years_3_5', payMin: j.payMin, payMax: j.payMax,
      jobType: (j.jobType ?? 'full_time') as never, jobTypes: [(j.jobType ?? 'full_time') as never],
      workSetting: 'commercial' as never, city: j.city, state: j.state, zipCode: j.zip,
      description: j.description, openingsCount: 2, status: 'open' as never,
      planTier: 'basic' as never, isFeatured: !!j.featured, isUrgent: false,
      expiresAt: new Date(Date.now() + 45 * 864e5),
    },
  });
}

async function ensurePost(userId: string, content: string, tradeTag?: string) {
  const found = await prisma.post.findFirst({ where: { userId, content } });
  if (found) return found;
  return prisma.post.create({ data: { userId, content, audience: 'anyone' as never, tradeTag: tradeTag ?? null } });
}

async function main() {
  const demoEmail = process.env.DEMO_EMAIL ?? 'demo@blubranch.com';
  const demoPassword = process.env.DEMO_PASSWORD ?? 'BluBranch-demo-2026!';

  // Employer + company + jobs
  const employer = await ensureUser({ email: 'hiring@meridianbuilds.com', firstName: 'Dana', lastName: 'Reyes', role: 'employer' });
  let company = await prisma.company.findFirst({ where: { employerId: employer.id } });
  if (!company) {
    company = await prisma.company.create({
      data: { employerId: employer.id, name: 'Meridian Builders', sizeRange: 'size_51_200' as never,
        contactEmail: 'hiring@meridianbuilds.com', industry: 'Commercial Construction',
        description: 'Commercial GC building across the Midwest. We hire skilled trades year-round.' },
    });
  }
  const jobs = [
    { title: 'Journeyman Electrician', tradeId: TRADE.electrician, payMin: 38, payMax: 52, city: 'Chicago', state: 'IL', zip: '60601', description: 'Commercial electrical install + service. Journeyman license required. Great benefits, steady work.', featured: true },
    { title: 'Commercial Plumber', tradeId: TRADE.plumber, payMin: 35, payMax: 48, city: 'Chicago', state: 'IL', zip: '60614', description: 'Rough-in and finish plumbing on commercial projects. 3+ years experience.' },
    { title: 'HVAC Installer', tradeId: TRADE.hvac, payMin: 32, payMax: 45, city: 'Evanston', state: 'IL', zip: '60201', description: 'Install and commission rooftop units and VAV systems. EPA cert a plus.' },
    { title: 'Structural Welder', tradeId: TRADE.welder, payMin: 34, payMax: 47, city: 'Gary', state: 'IN', zip: '46402', description: 'Structural steel welding, AWS D1.1. Certified welders preferred.' },
    { title: 'Finish Carpenter', tradeId: TRADE.carpenter, payMin: 30, payMax: 42, city: 'Chicago', state: 'IL', zip: '60607', description: 'High-end commercial finish carpentry. Attention to detail a must.' },
    { title: 'Ironworker – Reinforcing', tradeId: TRADE.ironworker, payMin: 36, payMax: 50, city: 'Chicago', state: 'IL', zip: '60616', description: 'Rebar placement on large concrete pours. Union shop.' },
  ];
  for (const j of jobs) await ensureJob(employer.id, company.id, j);

  // Worker "community" for the feed
  const workers = [
    { email: 'marcus.t@demo.blubranch.com', firstName: 'Marcus', lastName: 'Thompson', profile: { headline: 'Master Electrician • 20 yrs', bio: 'Commercial + industrial. IBEW.', currentTitle: 'Foreman', currentCompany: 'Voltline Electric', hourlyRate: 54 }, post: 'Wrapped up a 40k sq ft warehouse fit-out this week — clean panel schedule, zero callbacks. Proud of the crew. ⚡', tag: 'electrician' },
    { email: 'sofia.r@demo.blubranch.com', firstName: 'Sofia', lastName: 'Ramirez', profile: { headline: 'Journeyman Plumber', bio: 'Service + new construction. Chicago.', currentTitle: 'Journeyman', currentCompany: 'Ramirez Mechanical', hourlyRate: 46 }, post: 'PSA for the apprentices: label your shutoffs. Saved a customer a flooded basement today because the last crew did. Do the little things.', tag: 'plumber' },
    { email: 'jd.welds@demo.blubranch.com', firstName: 'James', lastName: 'Doyle', profile: { headline: 'Certified Welder • AWS D1.1', bio: 'Structural + pipe. Road-ready.', currentTitle: 'Welder', currentCompany: 'Great Lakes Steel', hourlyRate: 49 }, post: 'Passed my 6G recert this morning. Always worth keeping your tickets current — opens doors.', tag: 'welder' },
    { email: 'tanya.hvac@demo.blubranch.com', firstName: 'Tanya', lastName: 'Brooks', profile: { headline: 'HVAC Service Tech • EPA Universal', bio: 'Rooftop units, controls, VRF.', currentTitle: 'Lead Tech', currentCompany: 'ClimatePro', hourlyRate: 47 }, post: 'Rooftop season is here. Stay hydrated, check your harness, and don’t skip the pre-start checklist. Everybody goes home.', tag: 'hvac' },
  ];
  for (const w of workers) {
    const u = await ensureUser({ email: w.email, firstName: w.firstName, lastName: w.lastName, role: 'worker', profile: w.profile });
    await ensurePost(u.id, w.post, w.tag);
  }

  // Demo account (reviewer / screenshots)
  const demo = await ensureUser({
    email: demoEmail, password: demoPassword, firstName: 'Alex', lastName: 'Carter', role: 'worker',
    profile: { headline: 'Journeyman Electrician • Chicago', bio: 'Commercial electrician, 6 years. Open to work in the Chicagoland area. Licensed + insured.',
      currentTitle: 'Journeyman Electrician', currentCompany: 'Northside Electric', hourlyRate: 44, city: 'Chicago', state: 'IL', zipCode: '60618' },
  });
  await prisma.user.update({ where: { id: demo.id }, data: { phoneVerified: true } });
  await ensurePost(demo.id, 'Just joined BluBranch — looking to connect with other trades in Chicago. 6 years commercial electrical, open to new opportunities.', 'electrician');

  const jobCount = await prisma.job.count({ where: { status: 'open' } });
  const postCount = await prisma.post.count();
  console.log(`✓ Seeded. Open jobs: ${jobCount}, posts: ${postCount}. Demo login: ${demoEmail}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
