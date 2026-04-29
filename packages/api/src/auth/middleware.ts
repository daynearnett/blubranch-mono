import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@blubranch/shared';
import { verifyAccessToken } from './jwt.js';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Best-effort: attaches `request.user` if a valid access token is present.
 * Never throws — routes that *require* auth should chain `requireAuth`.
 */
export async function extractUser(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header) return;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return;
  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.sub, role: payload.role };
  } catch {
    // Invalid/expired tokens silently fall through; requireAuth handles rejection.
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await extractUser(request);
  }
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Valid bearer token required' });
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    if (!request.user || !roles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Forbidden', message: `Requires role: ${roles.join(', ')}` });
    }
  };
}
