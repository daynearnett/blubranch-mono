import { companyInputSchema } from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';

export async function companyRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /companies ─────────────────────────────────────────────
  // Mockup screen 7B. Employers post jobs against a company they own.
  app.post('/companies', { preHandler: requireRole('employer', 'admin') }, async (request, reply) => {
    const data = parseBody(companyInputSchema, request, reply);
    if (!data) return;
    const company = await prisma.company.create({
      data: { ...data, employerId: request.user!.id },
    });
    return reply.code(201).send(company);
  });

  // ── GET /users/me/company ───────────────────────────────────────
  // First company owned by the current employer (most common case;
  // multi-company support comes later).
  app.get('/users/me/company', { preHandler: requireAuth }, async (request) => {
    return prisma.company.findFirst({
      where: { employerId: request.user!.id },
      orderBy: { createdAt: 'asc' },
    });
  });

  // ── GET /companies/:id ──────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/companies/:id', async (request, reply) => {
    const company = await prisma.company.findUnique({
      where: { id: request.params.id },
    });
    if (!company) return reply.code(404).send({ error: 'NotFound' });
    return company;
  });

  // ── PUT /companies/:id ──────────────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/companies/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = parseBody(companyInputSchema, request, reply);
      if (!data) return;
      const existing = await prisma.company.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      if (existing.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      return prisma.company.update({ where: { id: existing.id }, data });
    },
  );
}
