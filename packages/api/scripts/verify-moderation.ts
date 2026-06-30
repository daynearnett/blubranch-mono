/**
 * Verify auto-moderation is live on STAGING after OPENAI_API_KEY is set.
 * Registers a throwaway worker, posts a clearly-violating TEXT string (a
 * credible threat → OpenAI "harassment/threatening"/"violence"); auto-mod
 * should reject it 422 before it's ever stored. A benign control post should
 * still succeed (201). Cleans up anything it creates.
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

const VIOLATING = 'I am going to find you and kill you and your whole family.';
const BENIGN = 'Wrapped up a clean panel install today — proud of the work.';

async function main() {
  const reg = await api('/auth/register', {
    method: 'POST',
    body: {
      firstName: 'Mod', lastName: 'Check', email: `modcheck-${stamp}@example.com`,
      password: 'Test1234!pw', role: 'worker', termsAccepted: true,
    },
  });
  const token = reg.data?.accessToken ?? reg.data?.token ?? reg.data?.tokens?.accessToken;
  if (!token) { console.log('✗ register failed:', reg.status, reg.data); process.exit(1); }

  let live = false;
  for (let i = 1; i <= 10; i++) {
    const res = await api('/posts', { method: 'POST', token, body: { content: VIOLATING } });
    if (res.status === 422) {
      console.log(`✓ violating text BLOCKED (422 ${res.data?.error}) — auto-mod LIVE`);
      live = true;
      break;
    }
    if (res.status === 201) {
      console.log(`[${i}] not blocked yet (redeploy pending?) — cleaning up post`);
      await api(`/posts/${res.data.id}`, { method: 'DELETE', token }).catch(() => {});
      await new Promise((r) => setTimeout(r, 20000));
    } else {
      console.log(`[${i}] unexpected`, res.status, res.data);
      await new Promise((r) => setTimeout(r, 20000));
    }
  }

  // Control: benign text should post fine.
  const control = await api('/posts', { method: 'POST', token, body: { content: BENIGN } });
  console.log(`control benign post: ${control.status} ${control.status === 201 ? '✓ allowed' : '✗'}`);
  if (control.status === 201) await api(`/posts/${control.data.id}`, { method: 'DELETE', token }).catch(() => {});

  console.log(live ? '\n✅ AUTO-MODERATION ACTIVE on staging' : '\n❌ Not blocking yet — check OPENAI_API_KEY / redeploy');
  process.exit(live ? 0 : 1);
}

main().catch((e) => { console.error('crashed:', e); process.exit(1); });
