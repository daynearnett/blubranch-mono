import jwt from 'jsonwebtoken';
import type { Role } from '@blubranch/shared';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'replace-me-with-a-long-random-string') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    // Dev fallback so the server boots without a real .env.
    return 'dev-only-jwt-secret-do-not-use-in-prod';
  }
  return secret;
}

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, type: 'access' } satisfies AccessTokenPayload, getSecret(), {
    expiresIn: ACCESS_TTL,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies RefreshTokenPayload, getSecret(), {
    expiresIn: REFRESH_TTL,
  });
}

export function signTokenPair(userId: string, role: Role): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken(userId, role),
    refreshToken: signRefreshToken(userId),
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, getSecret()) as AccessTokenPayload;
  if (payload.type !== 'access') throw new Error('Wrong token type');
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, getSecret()) as RefreshTokenPayload;
  if (payload.type !== 'refresh') throw new Error('Wrong token type');
  return payload;
}
