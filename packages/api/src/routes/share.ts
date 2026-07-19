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

  // Public Trade Card — a worker's verified credential card as a shareable
  // web page ("text your card to a GC"). Mirrors the post share page: OG tags
  // for rich link previews + a server-rendered card + app deep link. License
  // numbers are never shown here — type, state, status, and expiry month only.
  app.get<{ Params: { slug: string } }>('/share/card/:slug', async (request, reply) => {
    const base = `https://${request.headers.host ?? 'blubranch.com'}`;
    const appLink = `blubranch://u/${request.params.slug}`;
    const img = `${base}/share/logo.png`;

    let user: {
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
      trade: string | null;
      city: string | null;
      state: string | null;
      unionName: string | null;
      showUnion: boolean;
      licenses: Array<{ type: string; issuingState: string; expiresAt: Date | null }>;
      vouches: number;
    } | null = null;

    try {
      const u = await prisma.user.findFirst({
        where: { slug: request.params.slug },
        include: {
          workerProfile: true,
          settings: true,
          trades: { include: { trade: true }, take: 1 },
          licenses: {
            where: { status: 'verified' },
            select: { type: true, issuingState: true, expiresAt: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (u) {
        user = {
          firstName: u.firstName,
          lastName: u.lastName,
          profilePhotoUrl: u.profilePhotoUrl,
          trade: u.trades[0]?.trade?.name ?? null,
          city: u.workerProfile?.city ?? null,
          state: u.workerProfile?.state ?? null,
          unionName: u.workerProfile?.unionName ?? null,
          showUnion: u.settings?.showUnion ?? true,
          licenses: u.licenses,
          vouches: await prisma.vouch.count({
            where: { voucheeId: u.id, status: 'confirmed' },
          }),
        };
      }
    } catch {
      // fall through to the generic preview
    }

    if (!user) {
      return reply.code(404).header('Content-Type', 'text/html; charset=utf-8')
        .send('<!doctype html><html><head><title>BluBranch</title></head><body>Card not found.</body></html>');
    }

    const name = `${user.firstName} ${user.lastName}`;
    const titleBits = [user.trade, user.city && user.state ? `${user.city}, ${user.state}` : null]
      .filter(Boolean)
      .join(' · ');
    const licCount = user.licenses.length;
    const descBits = [
      licCount > 0 ? `${licCount} verified license${licCount === 1 ? '' : 's'}` : 'Trade Card',
      user.vouches > 0 ? `${user.vouches} vouch${user.vouches === 1 ? '' : 'es'} from people they've worked with` : null,
    ].filter(Boolean);
    const title = `${name}'s Trade Card${user.trade ? ` — ${user.trade}` : ''}`;
    const description = descBits.join(' · ') + ' · Verified on BluBranch';

    const fmtExpiry = (d: Date | null): string =>
      d ? `Expires ${d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}` : '';
    const licenseRows = user.licenses
      .map(
        (l) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid #E3EAF2">
<span><strong>${esc(l.type)}</strong> · ${esc(l.issuingState)} <span style="color:#22C55E;font-weight:700">✓ Verified</span></span>
<span style="color:#5C7A9B;font-size:13px">${esc(fmtExpiry(l.expiresAt))}</span></div>`,
      )
      .join('');

    const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta property="og:type" content="profile"/>
<meta property="og:site_name" content="BluBranch"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:url" content="${base}/share/card/${esc(request.params.slug)}"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${img}"/>
</head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F4F7FA;margin:0;padding:32px 16px">
<div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 16px rgba(15,45,82,.12);overflow:hidden">
<div style="background:linear-gradient(135deg,#B0C4DE,#4682B4);padding:20px 24px;color:#fff;display:flex;align-items:center;gap:12px">
<img src="${img}" width="40" height="40" alt="BluBranch" style="border-radius:10px"/>
<div><div style="font-size:12px;letter-spacing:1px;opacity:.85">BLUBRANCH TRADE CARD</div>
<div style="font-size:20px;font-weight:800">${esc(name)}</div></div>
</div>
<div style="padding:20px 24px;color:#0F2D52">
${user.trade ? `<div style="font-size:16px;font-weight:700;margin-bottom:2px">${esc(user.trade)}</div>` : ''}
${titleBits ? `<div style="color:#5C7A9B;font-size:14px;margin-bottom:12px">${esc(titleBits)}</div>` : ''}
${user.showUnion && user.unionName ? `<div style="display:inline-block;background:#EEF4FA;color:#3D5A80;font-size:13px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:12px">${esc(user.unionName)}</div>` : ''}
${licenseRows || '<div style="color:#5C7A9B;padding:10px 0;border-top:1px solid #E3EAF2">No verified licenses yet</div>'}
${user.vouches > 0 ? `<div style="padding:10px 0;border-top:1px solid #E3EAF2;color:#0F2D52"><strong>${user.vouches}</strong> vouch${user.vouches === 1 ? '' : 'es'} from people they've worked with</div>` : ''}
<a href="${appLink}" style="display:block;text-align:center;background:#3D5A80;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px">View full profile in BluBranch</a>
</div></div>
</body></html>`;

    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
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
      // Share pages are public (no viewer), so only reveal author + content for
      // posts that are actually public: 'anyone' audience and not archived.
      // Otherwise fall back to the generic BluBranch preview — no leak.
      if (post && post.audience === 'anyone' && !post.archived) {
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
