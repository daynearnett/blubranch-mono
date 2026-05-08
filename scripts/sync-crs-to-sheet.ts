/**
 * sync-crs-to-sheet.ts
 *
 * One-way sync: parses docs/CHANGE-REQUESTS.md and pushes ticket data to a Google Sheet.
 * Markdown is the source of truth. The sheet is a read-only-by-convention mirror used
 * for triage and dashboarding.
 *
 * Usage: `pnpm sync-crs` from the repo root.
 *
 * Required env vars:
 *   GOOGLE_SHEETS_CREDS_PATH — absolute path to the service account JSON key file.
 *                              Recommended location: ~/.config/blubranch/cr-sync-service-account.json
 *   GOOGLE_SHEETS_SHEET_ID   — the ID portion of the sheet URL
 *                              (https://docs.google.com/spreadsheets/d/SHEET_ID/edit)
 *
 * See docs/CR-SETUP.md for the one-time setup walkthrough.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status = 'Open' | 'In progress' | 'Fixed' | "Won't fix" | 'Duplicate';

interface Ticket {
  id: string;
  type: string;
  severity: string;
  status: Status;
  title: string;
  description: string;
  screenArea: string;
  platform: string;
  channel: string;
  reporter: string;
  reported: string;
  slack: string;
  fix: string;
}

// Order matters — this is the column order in the sheet.
const SHEET_COLUMNS = [
  'ID',
  'Type',
  'Severity',
  'Status',
  'Title',
  'Description',
  'Screen/area',
  'Platform',
  'Channel',
  'Reporter',
  'Reported',
  'Slack',
  'Fix',
  'Last synced',
] as const;

// ---------------------------------------------------------------------------
// Markdown parsing
// ---------------------------------------------------------------------------

/**
 * Parses CHANGE-REQUESTS.md and returns all tickets across all status sections.
 * Tickets are matched by the "### BMA-#### — <title>" header pattern.
 */
function parseTickets(markdownPath: string): Ticket[] {
  const raw = readFileSync(markdownPath, 'utf8');

  // Split on ticket headers. The regex captures the BMA ID and title.
  // Headers look like: "### BMA-0001 — Continue button cut off on iPhone 14"
  const ticketHeaderRe = /^### (BMA-\d{4}) — (.+)$/gm;

  const tickets: Ticket[] = [];
  const headerMatches: { id: string; title: string; index: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = ticketHeaderRe.exec(raw)) !== null) {
    const id = m[1];
    const title = m[2];
    if (id && title) {
      headerMatches.push({ id, title, index: m.index });
    }
  }

  for (let i = 0; i < headerMatches.length; i++) {
    const header = headerMatches[i];
    const next = headerMatches[i + 1];
    if (!header) continue;

    // Body of this ticket runs from after the header to either the next ticket
    // header or to a section separator ("---" on its own line, or "## " heading).
    const bodyStart = header.index + `### ${header.id} — ${header.title}`.length;
    const bodyEnd = next ? next.index : raw.length;
    const body = raw.slice(bodyStart, bodyEnd);

    tickets.push(parseTicketBody(header.id, header.title, body));
  }

  return tickets;
}

/**
 * Extracts field values from a single ticket's body. Field lines look like:
 *   - **FieldName:** value
 */
function parseTicketBody(id: string, title: string, body: string): Ticket {
  const get = (field: string): string => {
    const re = new RegExp(`^\\s*-\\s+\\*\\*${field}:\\*\\*\\s*(.+?)$`, 'mi');
    const match = body.match(re);
    return match?.[1]?.trim() ?? '';
  };

  const rawStatus = get('Status');
  // Strip the emoji icon from status — we want the text only for the sheet.
  const status = rawStatus
    .replace(/^[🔴🟡🟢⚫⚪]\s*/u, '')
    .trim() as Status;

  return {
    id,
    title,
    type: get('Type'),
    severity: get('Severity'),
    status: status || 'Open',
    description: get('Description'),
    screenArea: get('Screen / area') || get('Screen/area'),
    platform: get('Platform'),
    channel: get('Channel'),
    reporter: get('Reporter'),
    reported: get('Reported'),
    slack: get('Slack'),
    fix: get('Fix'),
  };
}

// ---------------------------------------------------------------------------
// Google Sheets sync
// ---------------------------------------------------------------------------

async function syncToSheet(tickets: Ticket[], credsPath: string, sheetId: string): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: credsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Build the rows. First row is headers; subsequent rows are tickets.
  const now = new Date().toISOString();
  const headerRow: string[] = [...SHEET_COLUMNS];
  const dataRows = tickets.map((t) => [
    t.id,
    t.type,
    t.severity,
    t.status,
    t.title,
    t.description,
    t.screenArea,
    t.platform,
    t.channel,
    t.reporter,
    t.reported,
    t.slack,
    t.fix,
    now,
  ]);

  const values = [headerRow, ...dataRows];

  // Strategy: clear the entire sheet, then write fresh. Simple and idempotent.
  // For a small number of tickets (probably < 1000 lifetime) this is fine.
  // If we ever need to preserve manual annotations in the sheet, switch to
  // upsert-by-ID logic.
  const clearRange = 'A:Z';
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: clearRange,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const credsPath = process.env['GOOGLE_SHEETS_CREDS_PATH'];
  const sheetId = process.env['GOOGLE_SHEETS_SHEET_ID'];

  if (!credsPath) {
    console.error('ERROR: GOOGLE_SHEETS_CREDS_PATH env var not set.');
    console.error('Add to your shell rc: export GOOGLE_SHEETS_CREDS_PATH=~/.config/blubranch/cr-sync-service-account.json');
    console.error('See docs/CR-SETUP.md for the full setup.');
    process.exit(1);
  }
  if (!sheetId) {
    console.error('ERROR: GOOGLE_SHEETS_SHEET_ID env var not set.');
    console.error('Add to your shell rc: export GOOGLE_SHEETS_SHEET_ID=<id from sheet URL>');
    console.error('See docs/CR-SETUP.md for the full setup.');
    process.exit(1);
  }

  // Resolve `~` in the creds path manually (Node does not expand it).
  const resolvedCredsPath = credsPath.startsWith('~')
    ? resolve(process.env['HOME'] ?? '', credsPath.slice(2))
    : resolve(credsPath);

  const markdownPath = resolve(process.cwd(), 'docs/CHANGE-REQUESTS.md');
  console.log(`Parsing ${markdownPath}...`);

  const tickets = parseTickets(markdownPath);
  console.log(`Found ${tickets.length} ticket(s).`);

  if (tickets.length === 0) {
    console.log('No tickets to sync. Sheet will be cleared but not populated.');
  }

  console.log(`Syncing to sheet ${sheetId}...`);
  await syncToSheet(tickets, resolvedCredsPath, sheetId);

  console.log(`✓ Synced ${tickets.length} ticket(s) to the sheet.`);
}

main().catch((err: unknown) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
