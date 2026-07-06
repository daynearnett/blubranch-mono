// Public legal pages. Privacy Policy + Terms of Service are rendered as HTML at
// stable URLs so they can be linked from the App Store listing, the marketing
// site, and the mobile app. No auth — must be publicly fetchable. Content is the
// shared canonical source (packages/shared) so app + web never drift.
import type { FastifyInstance } from 'fastify';
import { legalDocuments, type LegalDocument } from '@blubranch/shared';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBody(paragraphs: string[]): string {
  // Consecutive "• " lines collapse into a single <ul>.
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(`<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
      bullets = [];
    }
  };
  for (const p of paragraphs) {
    if (p.startsWith('• ')) bullets.push(p.slice(2));
    else {
      flush();
      out.push(`<p>${esc(p)}</p>`);
    }
  }
  flush();
  return out.join('\n');
}

export function renderDocument(doc: LegalDocument): string {
  const sections = doc.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${renderBody(s.body)}`)
    .join('\n');
  const effective = new Date(doc.effectiveDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(doc.title)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:#1F3A55; line-height:1.6; max-width:760px; margin:0 auto; padding:32px 20px 64px; }
  h1 { color:#0F2D52; font-size:26px; margin-bottom:4px; }
  h2 { color:#0F2D52; font-size:18px; margin-top:32px; }
  .meta { color:#5C7A9B; font-size:13px; margin-bottom:24px; }
  .banner { background:#FFF6D6; border:1px solid #E8C23A; color:#5c4a00;
    padding:12px 16px; border-radius:8px; font-size:14px; margin-bottom:28px; }
  ul { padding-left:20px; } li { margin:4px 0; }
  a { color:#E85D20; }
</style>
</head><body>
<h1>${esc(doc.title)}</h1>
<div class="meta">Version ${esc(doc.version)} · Effective ${esc(effective)}</div>
<div class="banner">${esc(doc.draftBanner)}</div>
${doc.intro.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${sections}
</body></html>`;
}

export async function legalRoutes(app: FastifyInstance): Promise<void> {
  const send = (reply: import('fastify').FastifyReply, doc: LegalDocument) =>
    reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=3600')
      .send(renderDocument(doc));

  app.get('/legal/privacy', async (_req, reply) => send(reply, legalDocuments.privacy));
  app.get('/legal/terms', async (_req, reply) => send(reply, legalDocuments.terms));

  // Simple index linking both.
  app.get('/legal', async (_req, reply) =>
    reply.header('Content-Type', 'text/html; charset=utf-8').send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>BluBranch — Legal</title>
<style>body{font-family:-apple-system,sans-serif;color:#1F3A55;max-width:640px;margin:0 auto;padding:48px 20px}a{color:#E85D20;display:block;margin:12px 0;font-size:18px}</style>
</head><body><h1>BluBranch Legal</h1>
<a href="/legal/privacy">Privacy Policy</a><a href="/legal/terms">Terms of Service</a></body></html>`,
    ),
  );
}
