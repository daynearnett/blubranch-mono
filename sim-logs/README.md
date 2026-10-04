# sim-logs — tester-agent simulation logs

Per-day logs from the BluBranch pre-launch tester-agent simulation (protocol:
[`docs/SIM-TESTER-AGENTS.md`](../docs/SIM-TESTER-AGENTS.md)). Six AI personas (3 workers,
3 employers across the Basic/Blu/Blu Max tiers) exercise the staging REST API daily and record
friction, bugs, and copy feedback.

## v2 run — Aug 15–20, 2026

| Day | Theme | Log | Run page (verbatim transcript) |
|-----|-------|-----|-------------------------------|
| Aug 15 | Onboarding | [2026-08-15.md](2026-08-15.md) | [session](https://claude.ai/code/session_01MPA9Zk5WutP4bXx7eL8RJB) |
| Aug 16 | Content | [2026-08-16.md](2026-08-16.md) | [session](https://claude.ai/code/session_016oqKDMykC2hnQDZB8pYfJY) |
| Aug 17 | Jobs | [2026-08-17.md](2026-08-17.md) | [session](https://claude.ai/code/session_01Pt6fGbq8AXVF2fos7NWNJG) |
| Aug 18 | Network | [2026-08-18.md](2026-08-18.md) | [session](https://claude.ai/code/session_01WgrT877fQwwowHYgcoc8jF) |
| Aug 19 | Messaging + notifications | [2026-08-19.md](2026-08-19.md) | [session](https://claude.ai/code/session_01KWL1ww2iqWS3b4ZWmJrPeW) |
| Aug 20 | Free play + regression | [2026-08-20.md](2026-08-20.md) | [session](https://claude.ai/code/session_01E3GdykGNPS5WQ4EPM2Hyc9) |

**Consolidated founders' one-pager:** [`docs/SIM-FINDINGS-2026-08-21.md`](../docs/SIM-FINDINGS-2026-08-21.md)

### Note on recovery
All six runs fired on schedule and tested staging, but every push 403'd — the Claude GitHub App
was never installed on the `daynearnett` account (fixed 2026-10-04; cloud sessions can push now).
The logs here were recovered from the run transcripts after the fix. Each file's front-matter links
its run page, where the run's verbatim log also lives.
