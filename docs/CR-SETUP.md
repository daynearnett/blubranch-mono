# CR Sync — One-Time Setup

This walks through everything needed to get `pnpm sync-crs` working. It's a one-time setup; after this, syncing is a single command.

**Time budget:** ~30-45 minutes. Most of it is clicking through Google Cloud Console.

**Prerequisites:**
- A Google account (the sheet will be created on this account)
- The repo cloned at `~/Dev/blubranch-mono`
- Node 20+ and pnpm installed (already true if you've worked on this repo)

---

## Step 1 — Install the new dependencies (~2 min)

The sync script depends on `googleapis` and `tsx` (added to `package.json` already, just need to install).

```bash
cd ~/Dev/blubranch-mono
pnpm install
```

That should pick up the two new devDeps and finish without errors.

---

## Step 2 — Create the Google Sheet (~5 min)

1. Open `https://sheets.new` in your browser. A blank sheet opens, untitled.
2. Click the title at the top-left ("Untitled spreadsheet") and rename to **`BluBranch CRs`**.
3. In **row 1**, paste this header row across cells A1 through N1 (14 columns):

   ```
   ID	Type	Severity	Status	Title	Description	Screen/area	Platform	Channel	Reporter	Reported	Slack	Fix	Last synced
   ```

   (Tab-separated. Paste into A1 and Google Sheets distributes across the row.)

4. Bold row 1 (select row 1, Cmd+B) and freeze it: **View → Freeze → 1 row**.

5. **Optional but recommended — set up dropdown validation** for these columns so manual edits stay consistent:
   - **Column B (Type):** select B2:B → Data → Data validation → Criteria: "Dropdown" → values: `Bug, Extension, Enhancement`
   - **Column C (Severity):** select C2:C → same flow → values: `P0, P1, P2, P3`
   - **Column D (Status):** select D2:D → same flow → values: `Open, In progress, Fixed, Won't fix, Duplicate`
   - **Column H (Platform):** select H2:H → same flow → values: `iOS, Android, Both, Backend, Admin`

6. **Optional — add a Dashboard tab.** Click `+` at the bottom-left to add a sheet. Rename to "Dashboard". Add useful formulas like:

   ```
   =COUNTIF('Sheet1'!D:D, "Open")             -> count of open
   =COUNTIF('Sheet1'!D:D, "In progress")       -> in progress
   =COUNTIFS('Sheet1'!C:C, "P0", 'Sheet1'!D:D, "Open")   -> open P0s
   =COUNTIFS('Sheet1'!C:C, "P1", 'Sheet1'!D:D, "Open")   -> open P1s
   ```

   (You can skip this and add it later — the sync still works without a dashboard tab.)

7. **Copy the sheet ID.** Look at the URL: `https://docs.google.com/spreadsheets/d/SOME_LONG_ID_HERE/edit`. Copy `SOME_LONG_ID_HERE` — you'll paste it in Step 4.

---

## Step 3 — Create a Google Cloud project + service account (~15 min)

This is the fiddly part. Take it slow; the UI is dense.

### 3a. Create a project

1. Go to `https://console.cloud.google.com/`
2. If prompted to accept terms, do so. (Free tier is fine; this won't incur charges.)
3. At the top, click the project dropdown → **New Project**
4. Name: `blubranch-cr-sync` (any name works; this is just for your reference)
5. Click **Create**. Wait ~10 seconds for it to provision.
6. Make sure the new project is selected (top dropdown should show `blubranch-cr-sync`)

### 3b. Enable the Sheets API

1. Left sidebar → **APIs & Services** → **Library**
2. Search "Google Sheets API" → click the result → **Enable**
3. Wait ~5 seconds for it to enable

### 3c. Create a service account

1. Left sidebar → **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **Service account**
3. Service account name: `cr-sync` (or anything memorable)
4. Service account ID: leave the auto-generated one
5. Click **Create and Continue**
6. **Skip** the "Grant this service account access to project" step (click **Continue**)
7. **Skip** the "Grant users access to this service account" step (click **Done**)

### 3d. Create the JSON key

1. On the Credentials page, find your new service account in the list and click on it
2. Tab: **Keys** → **Add Key** → **Create new key**
3. Type: **JSON** → **Create**
4. The JSON file downloads automatically (named something like `blubranch-cr-sync-abc123.json`)

### 3e. Move the JSON key to a safe location

```bash
mkdir -p ~/.config/blubranch
mv ~/Downloads/blubranch-cr-sync-*.json ~/.config/blubranch/cr-sync-service-account.json
chmod 600 ~/.config/blubranch/cr-sync-service-account.json
```

(The `chmod 600` makes it readable only by you. The file contains a private key — treat it like a password.)

### 3f. Note the service account email

Open the JSON file in a text editor:

```bash
cat ~/.config/blubranch/cr-sync-service-account.json | grep client_email
```

You'll see something like `"client_email": "cr-sync@blubranch-cr-sync.iam.gserviceaccount.com"`. Copy that email — you'll need it in Step 4.

---

## Step 4 — Share the sheet with the service account (~1 min)

Back in your `BluBranch CRs` Google Sheet:

1. Click the **Share** button (top-right)
2. In the "Add people and groups" field, paste the service account email from Step 3f
3. Permission: **Editor**
4. **Uncheck** "Notify people" (the service account doesn't have an inbox)
5. Click **Share**

You should see the service account email appear in the access list.

---

## Step 5 — Set environment variables (~2 min)

Add these to your shell rc file. For zsh on macOS (default):

```bash
echo '' >> ~/.zshrc
echo '# BluBranch CR sync' >> ~/.zshrc
echo 'export GOOGLE_SHEETS_CREDS_PATH=~/.config/blubranch/cr-sync-service-account.json' >> ~/.zshrc
echo 'export GOOGLE_SHEETS_SHEET_ID=PASTE_SHEET_ID_FROM_STEP_2_HERE' >> ~/.zshrc
```

Then either:
```bash
source ~/.zshrc
```
…or open a new terminal window. Verify:

```bash
echo $GOOGLE_SHEETS_CREDS_PATH
echo $GOOGLE_SHEETS_SHEET_ID
```

Both should print your values (not empty).

---

## Step 6 — Test the sync (~1 min)

```bash
cd ~/Dev/blubranch-mono
pnpm sync-crs
```

Expected output:
```
Parsing /Users/anthonyarnett/Dev/blubranch-mono/docs/CHANGE-REQUESTS.md...
Found 0 ticket(s).
No tickets to sync. Sheet will be cleared but not populated.
Syncing to sheet <ID>...
✓ Synced 0 ticket(s) to the sheet.
```

(0 tickets is correct for the first run — there are no tickets yet.)

Then open the sheet in your browser. You should see only the header row (row 1) with bold formatting. The "Last synced" column should be empty until there's a ticket to populate.

If you get an error mentioning permissions or "the caller does not have permission," double-check Step 4 (sheet shared with the service account email).

---

## Step 7 — File a test ticket (~3 min)

To prove the round-trip works, file a fake ticket through Claude Code:

1. Open Claude Code: `cd ~/Dev/blubranch-mono && claude`
2. Type:
   > Test: file a CR for "Test ticket — ignore me." Make it a P3 Enhancement, channel #styling, reporter Self. Don't make any code changes; just file the ticket.
3. Claude Code will create a `BMA-0001` entry in `docs/CHANGE-REQUESTS.md` and commit it
4. Run `pnpm sync-crs`
5. Refresh the sheet — `BMA-0001` should appear in row 2

If everything looks right, delete the test ticket from the markdown and re-sync:
```bash
# Edit docs/CHANGE-REQUESTS.md to remove the BMA-0001 block
# Then:
git add docs/CHANGE-REQUESTS.md
git commit -m "chore: remove test ticket BMA-0001"
git push
pnpm sync-crs
```

The sheet will go back to just the header row.

---

## Done — daily workflow from here

1. Cofounder posts CR in Slack
2. You open Claude Code, paste the post + screenshot, say "CR: file this and fix it"
3. Review diff, approve, Claude Code commits
4. Run `pnpm sync-crs`
5. Sheet updates

For edits: Claude Code → natural language ("bump BMA-0007 to P1") → review diff → commit → `pnpm sync-crs`.

---

## Troubleshooting

**"GOOGLE_SHEETS_CREDS_PATH env var not set"** — Step 5 didn't take, or you're in an old shell. Run `source ~/.zshrc` or open a fresh terminal.

**"The caller does not have permission"** — Service account isn't on the sheet's share list. Re-do Step 4.

**"ENOENT: no such file or directory" pointing at the JSON file** — Path is wrong. Verify with `ls -la ~/.config/blubranch/`. The file should be there.

**`pnpm sync-crs` says "Found 0 tickets" but you have tickets in the markdown** — The ticket block format is probably off. Check that headers look like `### BMA-0001 — Title here` (note: em-dash `—`, not hyphen `-`, and a space on each side).

**The sheet shows duplicate rows after sync** — Shouldn't happen with the current script (it clears the sheet before writing). If it does, the sheet permissions probably allow append-only — re-share with **Editor** access (not Commenter or Viewer).

**Tickets in the sheet are out of order** — The script writes them in the order they appear in the markdown. Fix the markdown order if you want a specific sequence in the sheet, or sort the sheet manually in the UI (sort doesn't sync back to markdown, so manual sheet sorts are cosmetic — the next sync will re-order).
