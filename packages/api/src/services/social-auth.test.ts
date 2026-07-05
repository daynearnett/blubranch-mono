import { describe, expect, it, beforeAll } from 'vitest';
import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  createLocalJWKSet,
  type JWTVerifyGetKey,
} from 'jose';
import {
  verifyAppleIdToken,
  verifyGoogleIdToken,
  SocialAuthError,
} from './social-auth.js';

// A locally-generated RSA key stands in for Apple/Google's JWKS so we can sign
// tokens the verifier will trust — without any network call.
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let keySet: JWTVerifyGetKey;

const APPLE_AUD = 'com.blubranch.app';
const GOOGLE_AUD = 'web-client.apps.googleusercontent.com';

beforeAll(async () => {
  process.env.APPLE_CLIENT_IDS = APPLE_AUD;
  process.env.GOOGLE_CLIENT_IDS = `${GOOGLE_AUD},ios-client.apps.googleusercontent.com`;

  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey;
  const pubJwk = await exportJWK(kp.publicKey);
  pubJwk.kid = 'test-key';
  pubJwk.alg = 'RS256';
  keySet = createLocalJWKSet({ keys: [pubJwk] });
});

interface Claims {
  iss: string;
  aud: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
  name?: string;
  exp?: number;
}

async function sign(claims: Claims): Promise<string> {
  const { exp, ...rest } = claims;
  const jwt = new SignJWT(rest as Record<string, unknown>)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt();
  jwt.setExpirationTime(exp ?? '5m');
  return jwt.sign(privateKey);
}

describe('verifyAppleIdToken', () => {
  it('extracts sub + email from a valid token', async () => {
    const token = await sign({
      iss: 'https://appleid.apple.com',
      aud: APPLE_AUD,
      sub: 'apple-sub-123',
      email: 'Worker@Example.com',
      email_verified: 'true',
    });
    const id = await verifyAppleIdToken(token, keySet);
    expect(id.provider).toBe('apple');
    expect(id.providerUserId).toBe('apple-sub-123');
    expect(id.email).toBe('worker@example.com'); // lowercased
    expect(id.emailVerified).toBe(true);
  });

  it('rejects a wrong audience (token minted for another app)', async () => {
    const token = await sign({
      iss: 'https://appleid.apple.com',
      aud: 'com.someone.else',
      sub: 'x',
      email: 'a@b.com',
    });
    await expect(verifyAppleIdToken(token, keySet)).rejects.toBeInstanceOf(SocialAuthError);
  });

  it('rejects a wrong issuer', async () => {
    const token = await sign({
      iss: 'https://evil.example.com',
      aud: APPLE_AUD,
      sub: 'x',
      email: 'a@b.com',
    });
    await expect(verifyAppleIdToken(token, keySet)).rejects.toBeInstanceOf(SocialAuthError);
  });

  it('rejects an expired token', async () => {
    const token = await sign({
      iss: 'https://appleid.apple.com',
      aud: APPLE_AUD,
      sub: 'x',
      email: 'a@b.com',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await expect(verifyAppleIdToken(token, keySet)).rejects.toBeInstanceOf(SocialAuthError);
  });

  it('rejects a token missing email', async () => {
    const token = await sign({
      iss: 'https://appleid.apple.com',
      aud: APPLE_AUD,
      sub: 'x',
    });
    await expect(verifyAppleIdToken(token, keySet)).rejects.toThrow(/missing email/);
  });
});

describe('verifyGoogleIdToken', () => {
  it('extracts sub, email, and name from a valid token', async () => {
    const token = await sign({
      iss: 'https://accounts.google.com',
      aud: GOOGLE_AUD,
      sub: 'google-sub-9',
      email: 'jane@example.com',
      email_verified: true,
      given_name: 'Jane',
      family_name: 'Welder',
    });
    const id = await verifyGoogleIdToken(token, keySet);
    expect(id.providerUserId).toBe('google-sub-9');
    expect(id.email).toBe('jane@example.com');
    expect(id.firstName).toBe('Jane');
    expect(id.lastName).toBe('Welder');
    expect(id.emailVerified).toBe(true);
  });

  it('accepts the bare-hostname issuer variant', async () => {
    const token = await sign({
      iss: 'accounts.google.com',
      aud: GOOGLE_AUD,
      sub: 's',
      email: 'a@b.com',
    });
    const id = await verifyGoogleIdToken(token, keySet);
    expect(id.providerUserId).toBe('s');
  });

  it('falls back to splitting `name` when given/family absent', async () => {
    const token = await sign({
      iss: 'https://accounts.google.com',
      aud: GOOGLE_AUD,
      sub: 's',
      email: 'a@b.com',
      name: 'Bob Vance Refrigeration',
    });
    const id = await verifyGoogleIdToken(token, keySet);
    expect(id.firstName).toBe('Bob');
    expect(id.lastName).toBe('Vance Refrigeration');
  });

  it('accepts a token minted for a secondary (iOS) client id', async () => {
    const token = await sign({
      iss: 'https://accounts.google.com',
      aud: 'ios-client.apps.googleusercontent.com',
      sub: 's',
      email: 'a@b.com',
    });
    const id = await verifyGoogleIdToken(token, keySet);
    expect(id.providerUserId).toBe('s');
  });

  it('rejects a wrong audience', async () => {
    const token = await sign({
      iss: 'https://accounts.google.com',
      aud: 'not-our-client.apps.googleusercontent.com',
      sub: 's',
      email: 'a@b.com',
    });
    await expect(verifyGoogleIdToken(token, keySet)).rejects.toBeInstanceOf(SocialAuthError);
  });
});
