// Today's Headlines — top blue-collar industry story, pulled from the trade
// press via RSS. Feeds are tried in priority order; the newest item from the
// first feed that answers becomes the day's headline. Dependency-free RSS
// parsing (regex over <item> blocks) — these feeds are simple RSS 2.0 and a
// parse miss just means we fall through to the next source.

import { getPrisma } from '../lib/prisma.js';

export interface RssItem {
  title: string;
  url: string;
  publishedAt: Date;
  summary: string | null;
  imageUrl: string | null;
}

export const HEADLINE_FEEDS: { source: string; url: string }[] = [
  { source: 'Construction Dive', url: 'https://www.constructiondive.com/feeds/news/' },
  { source: 'For Construction Pros', url: 'https://www.forconstructionpros.com/rss' },
  { source: 'ISHN', url: 'https://www.ishn.com/rss/articles' },
];

const FETCH_TIMEOUT_MS = 8000;
// Re-check the feeds when the newest stored headline is older than this.
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return null;
  return decodeEntities(m[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}

/** Parse RSS 2.0 XML into items, newest-first by pubDate. Exported for tests. */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]!;
    const title = tag(block, 'title');
    const url = tag(block, 'link');
    const pub = tag(block, 'pubDate');
    if (!title || !url || !pub) continue;
    const publishedAt = new Date(pub);
    if (Number.isNaN(publishedAt.getTime())) continue;

    // description carries encoded HTML: first <img src> + first <p> text.
    const descRaw = tag(block, 'description') ?? '';
    const img = descRaw.match(/<img[^>]+src="([^"]+)"/i);
    const para = descRaw.match(/<p>([\s\S]*?)<\/p>/i);
    // The description is HTML encoded inside XML — tag() stripped the XML
    // layer; decode the HTML layer's entities too.
    const text = decodeEntities((para ? para[1]! : descRaw).replace(/<[^>]+>/g, '')).trim();

    items.push({
      title,
      url,
      publishedAt,
      summary: text ? text.slice(0, 500) : null,
      imageUrl: img ? img[1]! : null,
    });
  }
  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

type Fetcher = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; text(): Promise<string> }>;

/**
 * Fetch the feeds in priority order and store the newest story from the
 * first one that yields items. Returns the stored headline row (or null if
 * every feed failed). Upserts by url, so re-runs are idempotent.
 */
export async function refreshHeadlines(fetchFn: Fetcher = fetch): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  for (const feed of HEADLINE_FEEDS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetchFn(feed.url, {
        signal: ctrl.signal,
        headers: { 'user-agent': 'BluBranchBot/1.0 (+https://blubranch.com)' },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const items = parseRss(await res.text());
      const top = items[0];
      if (!top) continue;

      const row = await prisma.headline.upsert({
        where: { url: top.url },
        create: {
          title: top.title.slice(0, 500),
          url: top.url,
          source: feed.source,
          summary: top.summary,
          imageUrl: top.imageUrl,
          publishedAt: top.publishedAt,
        },
        update: { fetchedAt: new Date() },
      });
      console.log(`[headlines] Top story from ${feed.source}: "${top.title.slice(0, 80)}"`);
      return row;
    } catch (err) {
      console.warn(`[headlines] ${feed.source} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

/**
 * Newest stored headline, lazily refreshing when stale or missing — so the
 * card works from the first request, not from the first cron tick. Refresh
 * failures degrade to whatever is stored.
 */
export async function getTodayHeadline() {
  const prisma = getPrisma();
  const newest = await prisma.headline.findFirst({ orderBy: { publishedAt: 'desc' } });
  const stale = !newest || Date.now() - newest.fetchedAt.getTime() > STALE_AFTER_MS;
  if (stale) {
    await refreshHeadlines().catch(() => null);
    return prisma.headline.findFirst({ orderBy: { publishedAt: 'desc' } });
  }
  return newest;
}
