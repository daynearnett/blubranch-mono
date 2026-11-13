// LinkedIn profile import — "Sign In with LinkedIn using OpenID Connect".
//
// What this is NOT: a sign-in provider. POST /auth/social is unauthenticated
// sign-in-or-provision, and calling it from a signed-in session would swap
// the session rather than enrich the profile. This is a separate,
// authenticated import that only ever reads claims and hands them back for
// the worker to confirm.
//
// What LinkedIn actually gives us: the `openid profile email` scopes return
// sub / name / given_name / family_name / picture / locale / email /
// email_verified. **Not** positions, skills or education — `r_basicprofile`
// was deprecated for new apps in Aug 2023 and full profile export needs
// LinkedIn partner approval. So this fills the name/photo/email corner of
// onboarding; the resume import is what fills work history and skills.
//
// Flow (the mobile app has no LinkedIn SDK and needs no new native module):
//   1. app opens the authorize URL with Linking.openURL + a state nonce
//   2. LinkedIn redirects to GET /auth/linkedin/callback (https, required)
//   3. we exchange code + client_secret for an id_token and verify it
//   4. we stash the verified claims under a one-time ticket and redirect to
//      blubranch://linkedin-import?ticket=... — a ticket, not the claims,
//      so no personal data rides in a URL
//   5. the app POSTs the ticket to /users/me/import/linkedin (authenticated)

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { getRedis } from '../lib/redis.js';

const LINKEDIN_ISSUER = 'https://www.linkedin.com';
const LINKEDIN_JWKS = createRemoteJWKSet(
  new URL('https://www.linkedin.com/oauth/openid/jwks'),
);
const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const SCOPES = 'openid profile email';

/** Short enough that an abandoned flow can't leave claims lying around. */
const STATE_TTL_SECONDS = 600;
const TICKET_TTL_SECONDS = 300;

export class LinkedInImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkedInImportError';
  }
}

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** Unset credentials → the feature is simply off, like Stripe and Google. */
export function isLinkedInConfigured(): boolean {
  return Boolean(env('LINKEDIN_CLIENT_ID') && env('LINKEDIN_CLIENT_SECRET'));
}

/**
 * Where LinkedIn sends the browser back to. Must be registered verbatim in
 * the LinkedIn app's "Authorized redirect URLs" — LinkedIn requires https,
 * which is why the exchange can't happen on the device.
 */
export function redirectUri(): string {
  const explicit = env('LINKEDIN_REDIRECT_URI');
  if (explicit) return explicit;
  const base = env('PUBLIC_API_URL') || 'https://api-staging.blubranch.com';
  return `${base.replace(/\/$/, '')}/auth/linkedin/callback`;
}

/** Deep link back into the app once the exchange is done. */
function appRedirect(params: Record<string, string>): string {
  const scheme = env('APP_URL_SCHEME') || 'blubranch';
  const qs = new URLSearchParams(params).toString();
  return `${scheme}://linkedin-import?${qs}`;
}

export interface LinkedInClaims {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  pictureUrl: string | null;
}

const stateKey = (state: string) => `linkedin:state:${state}`;
const ticketKey = (ticket: string) => `linkedin:ticket:${ticket}`;

/**
 * Short-lived key/value store for the state nonce and the claims ticket.
 *
 * Redis when it's reachable; an in-process map when it isn't. Same
 * degradation the Socket.io adapter already does (lib/socket.ts falls back
 * to in-memory rather than crashing on a Redis outage), and it keeps the
 * flow working on a dev machine with no Redis installed.
 *
 * The caveat, which only bites with more than one API instance: a callback
 * that lands on a different instance than the /start call won't find the
 * state and the worker gets "that session expired". Staging and production
 * both run a single instance with REDIS_URL wired, so this is a fallback,
 * not the normal path.
 */
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function memorySweep(): void {
  const now = Date.now();
  for (const [k, v] of memoryStore) if (v.expiresAt <= now) memoryStore.delete(k);
}

async function putEphemeral(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, value, 'EX', ttlSeconds);
  } catch {
    memorySweep();
    memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

/** Reads are single-use: the key is dropped whether it hit Redis or memory. */
async function takeEphemeral(key: string): Promise<string | null> {
  try {
    const value = await getRedis().get(key);
    if (value !== null) {
      await getRedis().del(key);
      return value;
    }
  } catch {
    // fall through to the in-process store
  }
  memorySweep();
  const hit = memoryStore.get(key);
  if (!hit) return null;
  memoryStore.delete(key);
  return hit.value;
}

/**
 * Begin the flow. The state nonce is bound to the requesting user so a
 * callback can only ever enrich the account that started it.
 */
export async function createAuthorizeUrl(userId: string): Promise<string> {
  if (!isLinkedInConfigured()) {
    throw new LinkedInImportError('LinkedIn import is not configured');
  }
  const state = randomUUID();
  await putEphemeral(stateKey(state), userId, STATE_TTL_SECONDS);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('LINKEDIN_CLIENT_ID'),
    redirect_uri: redirectUri(),
    state,
    scope: SCOPES,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** Consume the state nonce. Single-use: a replayed callback finds nothing. */
export async function consumeState(state: string): Promise<string | null> {
  return takeEphemeral(stateKey(state));
}

/**
 * Exchange the authorization code and verify the returned id_token against
 * LinkedIn's JWKS. Identity comes from the verified token only.
 */
export async function exchangeCode(code: string): Promise<LinkedInClaims> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('LINKEDIN_CLIENT_ID'),
    client_secret: env('LINKEDIN_CLIENT_SECRET'),
    redirect_uri: redirectUri(),
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new LinkedInImportError(`LinkedIn token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) {
    throw new LinkedInImportError('LinkedIn returned no id_token');
  }

  const { payload } = await jwtVerify(json.id_token, LINKEDIN_JWKS, {
    issuer: LINKEDIN_ISSUER,
    audience: env('LINKEDIN_CLIENT_ID'),
  }).catch(() => {
    throw new LinkedInImportError('Could not verify the LinkedIn token');
  });

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) throw new LinkedInImportError('LinkedIn token has no subject');

  const given = typeof payload.given_name === 'string' ? payload.given_name : '';
  const family = typeof payload.family_name === 'string' ? payload.family_name : '';
  const full = typeof payload.name === 'string' ? payload.name : '';
  const [fallbackFirst = '', ...fallbackRest] = full.trim().split(/\s+/).filter(Boolean);

  return {
    providerUserId: sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    firstName: given || fallbackFirst,
    lastName: family || fallbackRest.join(' '),
    pictureUrl: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

/** Stash verified claims behind a one-time ticket and build the deep link. */
export async function issueTicket(userId: string, claims: LinkedInClaims): Promise<string> {
  const ticket = randomUUID();
  await putEphemeral(ticketKey(ticket), JSON.stringify({ userId, claims }), TICKET_TTL_SECONDS);
  return appRedirect({ ticket });
}

export function errorRedirect(reason: string): string {
  return appRedirect({ error: reason });
}

/**
 * Redeem a ticket. Single-use, and only by the user who started the flow —
 * a ticket leaked to another session is useless.
 */
export async function redeemTicket(
  ticket: string,
  userId: string,
): Promise<LinkedInClaims | null> {
  const raw = await takeEphemeral(ticketKey(ticket));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId: string; claims: LinkedInClaims };
    if (parsed.userId !== userId) return null;
    return parsed.claims;
  } catch {
    return null;
  }
}
