// Resume import — parse a PDF resume into profile fields with Claude.
//
// This is the half of the onboarding import that actually populates "the
// majority" of a profile. LinkedIn's OIDC scopes stop at name/photo/email
// (see services/linkedin-import.ts), so work history and skills have to come
// from somewhere else — and a resume is something tradespeople plausibly
// have, including the PDF LinkedIn itself exports via "Save to PDF".
//
// Two deliberate choices:
//
//   • The file is parsed in memory and discarded. Nothing is written to S3 —
//     the uploads bucket serves objects publicly with immutable cache
//     headers, which is fine for post photos and wrong for a resume.
//
//   • Skills are resolved to real `skills` table ids by giving Claude the
//     candidate list for the worker's trade and constraining it to choose
//     from that. Free-text skill names would never match the reference
//     table, and the client can only submit ids.
//
// Nothing here writes to the profile. The route hands the parsed result back
// for the worker to confirm first — which also sidesteps the fact that
// POST /users/me/work-history is append-only with no DELETE route, so a
// silent auto-import that ran twice would duplicate every job.

import Anthropic from '@anthropic-ai/sdk';

export class ResumeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeImportError';
  }
}

export function isResumeImportConfigured(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim());
}

export interface ParsedWorkHistory {
  companyName: string;
  title: string;
  /** YYYY-MM; the client turns these into the dates the API wants. */
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}

export interface ParsedResume {
  headline: string | null;
  bio: string | null;
  workHistory: ParsedWorkHistory[];
  skillIds: number[];
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'bio', 'workHistory', 'skillIds'],
  properties: {
    headline: {
      type: ['string', 'null'],
      maxLength: 200,
      description: 'One line describing the trade and level, e.g. "Journeyman electrician".',
    },
    bio: {
      type: ['string', 'null'],
      maxLength: 300,
      description:
        'Two or three plain sentences in the worker\'s own voice. No marketing language.',
    },
    workHistory: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['companyName', 'title', 'startDate', 'endDate', 'isCurrent'],
        properties: {
          companyName: { type: 'string', maxLength: 200 },
          title: { type: 'string', maxLength: 200 },
          startDate: { type: 'string', description: 'YYYY-MM' },
          endDate: { type: ['string', 'null'], description: 'YYYY-MM, or null if current' },
          isCurrent: { type: 'boolean' },
        },
      },
    },
    skillIds: {
      type: 'array',
      maxItems: 8,
      items: { type: 'integer' },
      description: 'Only ids from the provided candidate list. Empty if none clearly apply.',
    },
  },
} as const;

const SYSTEM = [
  'You extract structured profile data from a tradesperson\'s resume for BluBranch,',
  'a job platform for skilled trades.',
  '',
  'Rules:',
  '- Only report what the resume actually says. Never invent an employer, a date,',
  '  or a credential. Omit anything you are unsure of rather than guessing.',
  '- Dates are YYYY-MM. If a resume gives only a year, use January of that year.',
  '- Exactly one entry may have isCurrent true, and that entry must have a null endDate.',
  '- skillIds must come from the candidate list in the user message. Do not invent ids.',
  '- Write the bio in the first person, plainly, the way a tradesperson talks about',
  '  their own work. No "passionate", no "results-driven".',
  '- If the document is not a resume, return nulls and empty arrays.',
].join('\n');

/**
 * @param pdf       raw PDF bytes (the Messages API takes the document directly;
 *                  no local text extraction step)
 * @param skillOptions candidate skills for the worker's trade(s)
 */
export async function parseResume(
  pdf: Buffer,
  skillOptions: { id: number; name: string }[],
): Promise<ParsedResume> {
  if (!isResumeImportConfigured()) {
    throw new ResumeImportError('Resume import is not configured');
  }

  const client = new Anthropic();
  const candidates = skillOptions.map((s) => `${s.id}: ${s.name}`).join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 4000,
    system: SYSTEM,
    // Extraction, not reasoning — the cheap end of the effort range is the
    // right default here.
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: RESULT_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdf.toString('base64'),
            },
          },
          {
            type: 'text',
            text: candidates
              ? `Candidate skills (id: name) — choose only from these:\n${candidates}`
              : 'No candidate skills were supplied; return an empty skillIds array.',
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed: ParsedResume;
  try {
    parsed = JSON.parse(text) as ParsedResume;
  } catch {
    throw new ResumeImportError('Could not read that resume. Try a different file.');
  }

  // Belt and braces: the schema constrains the model, but the ids still get
  // clamped to the real reference set before anything reaches the client.
  const allowed = new Set(skillOptions.map((s) => s.id));
  return {
    headline: parsed.headline?.trim() || null,
    bio: parsed.bio?.trim() || null,
    workHistory: (parsed.workHistory ?? []).filter(
      (w) => w.companyName?.trim() && w.title?.trim() && /^\d{4}-\d{2}$/.test(w.startDate ?? ''),
    ),
    skillIds: (parsed.skillIds ?? []).filter((id) => allowed.has(id)),
  };
}
