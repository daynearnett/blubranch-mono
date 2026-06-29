// Phase 6 — automated content moderation via OpenAI's free omni-moderation
// endpoint (text + images). Fail-OPEN and graceful: with no OPENAI_API_KEY (or
// on any API error) content is allowed, so the app never hard-depends on it.
//
// Policy: we BLOCK only high-confidence violations in the "hard" categories
// (sexual/explicit, minors, real violence, credible threats). Everything else
// is left to the user report flow + admin queue.

const ENDPOINT = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

// Categories that cause an outright block (OpenAI category keys).
const HARD_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
  'harassment/threatening',
  'hate/threatening',
] as const;

export interface ModerationResult {
  flagged: boolean;
  blocked: boolean;
  categories: string[]; // flagged category keys
}

const ALLOW: ModerationResult = { flagged: false, blocked: false, categories: [] };

export function isModerationConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}

/**
 * Pure decision from an OpenAI moderation `results[0]` object. Exported for
 * unit testing without hitting the network.
 */
export function decideFromResult(result: {
  flagged?: boolean;
  categories?: Record<string, boolean>;
}): ModerationResult {
  const categories = result.categories ?? {};
  const flaggedCats = Object.keys(categories).filter((k) => categories[k]);
  const blocked = HARD_CATEGORIES.some((c) => categories[c]);
  return { flagged: !!result.flagged, blocked, categories: flaggedCats };
}

async function callModeration(input: unknown): Promise<ModerationResult> {
  if (!isModerationConfigured()) return ALLOW;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, input }),
    });
    if (!res.ok) {
      console.warn(`[moderation] OpenAI ${res.status} — failing open`);
      return ALLOW;
    }
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const first = data.results?.[0];
    if (!first) return ALLOW;
    return decideFromResult(first as { flagged?: boolean; categories?: Record<string, boolean> });
  } catch (err) {
    console.warn('[moderation] request failed — failing open:', (err as Error).message);
    return ALLOW;
  }
}

/** Moderate free text (post / comment body). */
export async function moderateText(text: string): Promise<ModerationResult> {
  if (!text.trim()) return ALLOW;
  return callModeration(text);
}

/**
 * Moderate an image. Accepts a raw buffer (moderated BEFORE it's persisted) —
 * passed to OpenAI as a base64 data URI.
 */
export async function moderateImageBuffer(buffer: Buffer, contentType: string): Promise<ModerationResult> {
  if (!isModerationConfigured()) return ALLOW;
  const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
  return callModeration([{ type: 'image_url', image_url: { url: dataUri } }]);
}
