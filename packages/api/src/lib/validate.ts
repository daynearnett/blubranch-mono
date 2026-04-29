import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodError, ZodSchema } from 'zod';

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
