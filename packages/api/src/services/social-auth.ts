import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

/**
 * Verified identity extracted from a provider's signed id_token.
 * `email`/`sub` come from the cryptographically-verified token — never the client.
 */
export interface VerifiedSocialIdentity {
  provider: 'apple' | 'google';
  providerUserId: string; // stable `sub` claim
  email: string;
  emailVerified: boolean;
  // Name is only present for Google (and Apple's very first sign-in, sent separately
  // by the client — not from the token). May be empty.
  firstName: string;
  lastName: string;
}

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** Comma-separated env → trimmed non-empty list. */
function envList(name: string): string[] {
  return env(name)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export class SocialAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialAuthError';
  }
}

// Remote JWKS sets are cached + auto-refreshed by jose (respects Cache-Control).
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const APPLE_ISSUER = 'https://appleid.apple.com';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Allowed audiences (client/bundle ids) the token must be minted for. */
function appleAudiences(): string[] {
  // Defaults to the iOS bundle id; override/extend for a web Services ID.
  const configured = envList('APPLE_CLIENT_IDS');
  return configured.length ? configured : ['com.blubranch.app'];
}

function googleAudiences(): string[] {
  // Web + iOS OAuth client ids issued by Google Cloud. The `@react-native-google-signin`
  // idToken carries the *web* client id as `aud` when a serverClientId is set.
  return envList('GOOGLE_CLIENT_IDS');
}

function splitName(full: string | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/**
 * Verify an Apple id_token: signature (Apple JWKS), issuer, audience, expiry.
 * Apple omits the user's name from the token — the client supplies it only on the
 * first authorization, so identity here is `sub` + `email` only.
 */
export async function verifyAppleIdToken(
  idToken: string,
  keySet: JWTVerifyGetKey = APPLE_JWKS,
): Promise<VerifiedSocialIdentity> {
  const audiences = appleAudiences();
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keySet, {
      issuer: APPLE_ISSUER,
      audience: audiences,
    }));
  } catch (err) {
    throw new SocialAuthError(
      `Apple token verification failed: ${(err as Error).message}`,
    );
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!sub) throw new SocialAuthError('Apple token missing subject');
  if (!email) throw new SocialAuthError('Apple token missing email');

  // Apple sends email_verified as string "true"/"false" or boolean.
  const rawVerified = payload.email_verified as unknown;
  const emailVerified = rawVerified === true || rawVerified === 'true';

  return {
    provider: 'apple',
    providerUserId: sub,
    email,
    emailVerified,
    firstName: '',
    lastName: '',
  };
}

/**
 * Verify a Google id_token: signature (Google certs), issuer, audience, expiry.
 * Google includes verified email + name claims.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  keySet: JWTVerifyGetKey = GOOGLE_JWKS,
): Promise<VerifiedSocialIdentity> {
  const audiences = googleAudiences();
  if (audiences.length === 0) {
    throw new SocialAuthError('Google sign-in not configured (GOOGLE_CLIENT_IDS unset)');
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keySet, {
      issuer: GOOGLE_ISSUERS,
      audience: audiences,
    }));
  } catch (err) {
    throw new SocialAuthError(
      `Google token verification failed: ${(err as Error).message}`,
    );
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!sub) throw new SocialAuthError('Google token missing subject');
  if (!email) throw new SocialAuthError('Google token missing email');

  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

  const given = typeof payload.given_name === 'string' ? payload.given_name : '';
  const family = typeof payload.family_name === 'string' ? payload.family_name : '';
  const fallback = splitName(typeof payload.name === 'string' ? payload.name : undefined);

  return {
    provider: 'google',
    providerUserId: sub,
    email,
    emailVerified,
    firstName: given || fallback.firstName,
    lastName: family || fallback.lastName,
  };
}

export async function verifySocialIdToken(
  provider: 'apple' | 'google',
  idToken: string,
): Promise<VerifiedSocialIdentity> {
  return provider === 'apple'
    ? verifyAppleIdToken(idToken)
    : verifyGoogleIdToken(idToken);
}
