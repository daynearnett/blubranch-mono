// Public OpenGraph share pages. When a post is shared as a link, iMessage /
// social fetch GET /share/post/:id and render a rich preview (BluBranch logo +
// author + excerpt) instead of the bare-text placeholder. The page then
// deep-links into the app. No auth — these must be fetchable by link crawlers.
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPrisma } from '../lib/prisma.js';

const LOGO_PATH = fileURLToPath(new URL('../../assets/og-logo.png', import.meta.url));
let logoCache: Buffer | null = null;
function getLogo(): Buffer | null {
  if (logoCache) return logoCache;
  try {
    logoCache = readFileSync(LOGO_PATH);
    return logoCache;
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function shareRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // Apple App Site Association — lets iOS open https share links directly in
  // the app (Universal Links) instead of showing the "Open in BluBranch?"
  // browser prompt. Served unauthenticated at the well-known path; Apple
  // fetches it to verify the app↔domain association.
  app.get('/.well-known/apple-app-site-association', async (_request, reply) => {
    return reply.header('Content-Type', 'application/json').send({
      applinks: {
        apps: [],
        details: [{ appID: 'WXY2PMFQB7.com.blubranch.app', paths: ['/share/*'] }],
      },
    });
  });

  // Generic https → app redirect, used by email buttons (email clients ignore
  // custom blubranch:// schemes, so links must be http(s)).
  app.get('/share/open', async (_request, reply) => {
    const appLink = 'blubranch://';
    const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>BluBranch</title></head>
<body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px 24px;color:#3D5A80">
<h2>Opening BluBranch…</h2>
<a href="${appLink}" style="display:inline-block;background:#3D5A80;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Open BluBranch</a>
<script>setTimeout(function(){location.href=${JSON.stringify(appLink)};},200);</script>
</body></html>`;
    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  app.get('/share/logo.png', async (_request, reply) => {
    const logo = getLogo();
    if (!logo) return reply.code(404).send();
    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .send(logo);
  });

  app.get<{ Params: { id: string } }>('/share/post/:id', async (request, reply) => {
    const base = `https://${request.headers.host ?? 'blubranch.com'}`;
    const appLink = `blubranch://post/${request.params.id}`;
    let title = 'BluBranch';
    let description = 'The professional network built for the Blue Collar.';

    try {
      const post = await prisma.post.findUnique({
        where: { id: request.params.id },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (post) {
        title = `${post.user.firstName} ${post.user.lastName} on BluBranch`;
        description =
          post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content;
      }
    } catch {
      // fall back to the generic BluBranch preview
    }

    const img = `${base}/share/logo.png`;
    const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="BluBranch"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:url" content="${base}/share/post/${request.params.id}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${img}"/>
</head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:48px 24px;color:#0F2D52">
<img src="${img}" width="72" height="72" alt="BluBranch" style="border-radius:16px"/>
<h2>${esc(title)}</h2>
<p style="color:#5C7A9B;max-width:480px;margin:0 auto 24px">${esc(description)}</p>
<a href="${appLink}" style="display:inline-block;background:#E85D20;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open in BluBranch</a>
<script>setTimeout(function(){location.href=${JSON.stringify(appLink)};},300);</script>
</body></html>`;

    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });
}
