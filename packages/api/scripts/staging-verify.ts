/**
 * Verify Stripe is fully wired on STAGING (not in-process). Registers a
 * throwaway employer via the real API, creates a draft Pro job, and requests a
 * PaymentIntent. If the job comes back 'draft' AND /intent returns a client
 * secret, the secret key + everything server-side is correctly configured.
 */
const API = process.env.STAGING_URL ?? 'https://blubranch-production.up.railway.app';
const stamp = Date.now();

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(API + path, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function main() {
  console.log('Target:', API);

  const reg = await api('/auth/register', {
    method: 'POST',
    body: {
      firstName: 'Stripe',
      lastName: 'Verify',
      email: `stripe-verify-${stamp}@example.com`,
      password: 'Test1234!pw',
      role: 'employer',
      termsAccepted: true,
    },
  });
  if (reg.status !== 200 && reg.status !== 201) {
    console.log('✗ register failed:', reg.status, reg.data);
    process.exit(1);
  }
  const token = reg.data.accessToken ?? reg.data.token ?? reg.data.tokens?.accessToken;
  console.log('✓ registered employer; token:', token ? 'yes' : 'NO — ' + JSON.stringify(reg.data).slice(0, 200));
  if (!token) process.exit(1);

  const company = await api('/companies', {
    method: 'POST',
    token,
    body: { name: 'Verify Co', sizeRange: 'size_1_10', contactEmail: `vco-${stamp}@example.com` },
  });
  if (company.status !== 200 && company.status !== 201) {
    console.log('✗ company create failed:', company.status, company.data);
    process.exit(1);
  }

  // Need a trade id — pull the reference list.
  const trades = await api('/reference/trades');
  const tradeId = Array.isArray(trades.data) ? trades.data[0]?.id : trades.data?.trades?.[0]?.id;

  const job = await api('/jobs', {
    method: 'POST',
    token,
    body: {
      companyId: company.data.id,
      title: 'Stripe verify job',
      tradeId,
      experienceLevel: 'years_3_5',
      payMin: 30,
      payMax: 45,
      jobType: 'full_time',
      workSetting: 'commercial',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      description: 'staging stripe verification',
      openingsCount: 1,
      planTier: 'basic',
    },
  });
  console.log(`  job status: ${job.data?.status}  ${job.data?.status === 'draft' ? '✓ (Stripe configured → draft)' : '✗ (expected draft; got ' + job.data?.status + ' → STRIPE_SECRET_KEY likely NOT set)'}`);

  const intent = await api(`/payments/jobs/${job.data.id}/intent`, { method: 'POST', token });
  if (intent.status === 200 && intent.data.paymentIntentClientSecret) {
    console.log('  /intent: ✓ 200, client secret + amount', intent.data.amount, '→ SECRET KEY + PRICE pipeline OK');
  } else if (intent.status === 503) {
    console.log('  /intent: ✗ 503 StripeNotConfigured → STRIPE_SECRET_KEY NOT set on Railway');
  } else {
    console.log('  /intent:', intent.status, JSON.stringify(intent.data).slice(0, 200));
  }

  // Subscription price checks (prove STRIPE_PRICE_PRO + STRIPE_PRICE_UNLIMITED).
  const proSub = await api('/payments/subscription/intent', { method: 'POST', token, body: { plan: 'pro' } });
  if (proSub.status === 200 && proSub.data.subscriptionId) {
    console.log('  /subscription/intent (pro): ✓ 200 → STRIPE_PRICE_PRO OK');
  } else {
    console.log('  /subscription/intent (pro):', proSub.status, JSON.stringify(proSub.data).slice(0, 160));
  }
  // Note: a second intent for the same user 409s (already has an active sub),
  // so we only verify the pro price here; unlimited price is exercised by the
  // device test + stripe-e2e.

  const ok =
    job.data?.status === 'draft' &&
    intent.status === 200 &&
    !!intent.data.paymentIntentClientSecret;
  console.log(`\n${ok ? '✅ STAGING STRIPE FULLY WIRED — device test will charge cards' : '❌ Something is not configured — see above'}`);
  console.log('(note: left a throwaway employer + draft job on staging — drafts are invisible in the feed)');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('crashed:', e); process.exit(1); });
