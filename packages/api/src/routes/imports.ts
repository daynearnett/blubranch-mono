// Onboarding profile import — LinkedIn and resume.
//
// Both endpoints only ever *return* parsed data. Nothing writes to the
// profile here: the app shows the worker what was found and they confirm,
// which keeps a bad parse from quietly overwriting good data and avoids
// duplicating work history (POST /users/me/work-history is append-only with
// no DELETE route).
//
// See services/linkedin-import.ts for why LinkedIn needs a server-side
// callback and why this isn't routed through POST /auth/social.

import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import {
  consumeState,
  createAuthorizeUrl,
  errorRedirect,
  exchangeCode,
  isLinkedInConfigured,
  issueTicket,
  redeemTicket,
} from '../services/linkedin-import.js';
import {
  isResumeImportConfigured,
  parseResume,
  ResumeImportError,
} from '../services/resume-import.js';

/** Resumes run larger than post photos, and are never stored. */
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export async function importRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── GET /imports/config ─────────────────────────────────────────
  // The onboarding screen hides whichever option isn't configured, the same
  // way the Google button hides on a missing client id.
  app.get('/imports/config', async () => ({
    linkedin: isLinkedInConfigured(),
    resume: isResumeImportConfigured(),
  }));

  // ── POST /imports/linkedin/start ────────────────────────────────
  // Returns the URL for the app to open. The state nonce is bound to the
  // caller, so the callback can only enrich the account that started it.
  app.post('/imports/linkedin/start', { preHandler: requireAuth }, async (request, reply) => {
    if (!isLinkedInConfigured()) {
      return reply
        .code(503)
        .send({ error: 'NotConfigured', message: 'LinkedIn import is not available yet.' });
    }
    return { authorizeUrl: await createAuthorizeUrl(request.user!.id) };
  });

  // ── GET /auth/linkedin/callback ─────────────────────────────────
  // Hit by LinkedIn's browser redirect, not by the app — unauthenticated by
  // necessity. The state nonce carries the identity, and the response is
  // always a redirect back into the app, never data.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/auth/linkedin/callback',
    async (request, reply) => {
      const { code, state, error } = request.query;
      if (error || !code || !state) {
        return reply.redirect(errorRedirect(error ?? 'cancelled'));
      }
      const userId = await consumeState(state);
      if (!userId) {
        // Unknown, expired or replayed state.
        return reply.redirect(errorRedirect('expired'));
      }
      try {
        const claims = await exchangeCode(code);
        return reply.redirect(await issueTicket(userId, claims));
      } catch (err) {
        request.log.warn({ err }, 'linkedin exchange failed');
        return reply.redirect(errorRedirect('failed'));
      }
    },
  );

  // ── POST /users/me/import/linkedin ──────────────────────────────
  // Redeem the one-time ticket for the verified claims. Single-use, and
  // only by the user who started the flow.
  app.post<{ Body: { ticket?: string } }>(
    '/users/me/import/linkedin',
    { preHandler: requireAuth },
    async (request, reply) => {
      const ticket = request.body?.ticket;
      if (typeof ticket !== 'string' || !ticket) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Missing ticket' });
      }
      const claims = await redeemTicket(ticket, request.user!.id);
      if (!claims) {
        return reply
          .code(401)
          .send({ error: 'InvalidTicket', message: 'That LinkedIn session expired. Try again.' });
      }
      // LinkedIn's `openid profile email` scopes stop here — no positions,
      // no skills. The resume import covers those.
      return {
        firstName: claims.firstName,
        lastName: claims.lastName,
        email: claims.emailVerified ? claims.email : null,
        pictureUrl: claims.pictureUrl,
      };
    },
  );

  // ── POST /users/me/import/resume ────────────────────────────────
  // A separate route from /upload/image on purpose: that one allowlists five
  // image extensions and pipes every upload through sharp() to strip EXIF,
  // which throws on a PDF. The file is parsed in memory and never stored.
  app.post('/users/me/import/resume', { preHandler: requireAuth }, async (request, reply) => {
    if (!isResumeImportConfigured()) {
      return reply
        .code(503)
        .send({ error: 'NotConfigured', message: 'Resume import is not available yet.' });
    }

    const file = await request.file({ limits: { fileSize: MAX_RESUME_BYTES } });
    if (!file) {
      return reply.code(400).send({ error: 'BadRequest', message: 'No file uploaded' });
    }
    const name = (file.filename ?? '').toLowerCase();
    if (!name.endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      return reply
        .code(400)
        .send({ error: 'BadRequest', message: 'Upload a PDF — most resume apps can export one.' });
    }

    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      return reply.code(413).send({ error: 'PayloadTooLarge', message: 'Max 10MB' });
    }

    // Candidate skills are scoped to the worker's trades so the model picks
    // from a short, relevant list rather than all 100-odd.
    const trades = await prisma.userTrade.findMany({
      where: { userId: request.user!.id },
      select: { tradeId: true },
    });
    const skills = await prisma.skill.findMany({
      where: trades.length ? { tradeId: { in: trades.map((t) => t.tradeId) } } : {},
      select: { id: true, name: true },
      take: 150,
    });

    try {
      return await parseResume(buffer, skills);
    } catch (err) {
      if (err instanceof ResumeImportError) {
        return reply.code(422).send({ error: 'ResumeUnreadable', message: err.message });
      }
      request.log.error({ err }, 'resume parse failed');
      return reply
        .code(502)
        .send({ error: 'ImportFailed', message: "Couldn't read that resume. Try again." });
    }
  });
}
