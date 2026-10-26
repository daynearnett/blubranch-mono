import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodError, ZodSchema } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every `:id` route param that maps to a `@db.Uuid` Prisma column needs this
 * BEFORE the lookup — Postgres rejects a non-UUID string at the driver
 * level, which surfaces as a raw, unauthenticated-reachable Prisma error
 * (P2023) leaking internals instead of a clean 404.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseBody<T>(
  schema: ZodSchema<T>,
  request: FastifyRequest,
  reply: FastifyReply,
): T | null {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    reply.code(400).send({
      error: 'ValidationError',
      issues: zodIssuesToFlat(result.error),
    });
    return null;
  }
  return result.data;
}

export function zodIssuesToFlat(error: ZodError) {
  return error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
}
