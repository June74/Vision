# SB-20260726-215244-neon-editor-rendered-text-not-full-model: Neon editor rendered text did not prove full migration transfer

- **Status:** closed
- **First observed:** 2026-07-26T21:52:44.1939214Z
- **Last observed:** 2026-07-26T21:58:19.6876526Z
- **Phase/task:** Phase B live database migration
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `6a14659`

## Symptom

After staging the six-file migration transaction, the visible CodeMirror
surface rendered fewer characters than the source bundle, so a direct rendered
text hash did not match.

## Impact

The transaction was not executed. Live preview schema and application data
remain unchanged.

## Reproduction conditions

Fill the visible Neon CodeMirror surface with a migration bundle longer than
the editor's rendered viewport, then hash `innerText`.

## Safe evidence

The source bundle contained six reviewed files and 23,512 UTF-8 bytes. The
rendered surface exposed 1,653 characters, differed at the first character,
and did not match after line-ending normalization.

## Attempts and outcomes

- The bundle was staged but not executed.
- Rendered text was compared using counts and hashes only.
- A page-level keyboard command was unavailable in the browser control layer;
  the attempt failed before retrieving or executing any text.
- The editor-level Select All command succeeded, but the browser evaluation
  sandbox did not expose a global selection API. The attempt again stopped
  before retrieving or executing any SQL.
- Copying through CodeMirror and reading through the browser client's clipboard
  API produced all 23,512 characters and an exact source hash match.
- After execution, the first status probe used an unsupported button-state
  helper and returned no result; fixed success/error labels are used instead.
- The initial timestamp command used a PowerShell parameter unavailable in this
  environment; the portable .NET UTC clock succeeded.
- A model-level or selection-level integrity proof is pending.

## Cause classification

- **Confirmed cause:** CodeMirror virtualizes rendered lines, so `innerText`
  did not represent the complete editor document.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** Line-ending normalization did not explain the
  mismatch.
- **Known exclusions:** No SQL was executed and no secret or provider
  identifier was captured.

## Correction and prevention

- **Correction:** Use CodeMirror's Select All and Copy behavior, then hash the
  browser client's clipboard text without printing the SQL.
- **Prevention:** Never run a long destructive SQL bundle based only on
  viewport-rendered text.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Select the full editor document and compare only
  its length and cryptographic hash with the reviewed source.

## Verification and related work

The CodeMirror copy path produced all 23,512 characters with an exact SHA-256
match to the reviewed six-file transaction. The transaction was then executed,
and a read-only post-check returned the exact `VISION_SCHEMA_0009_OK` marker
with no mismatch marker.

## Recurrence history

- 2026-07-26T21:52:44.1939214Z: First observed and contained before execution.
- 2026-07-26T21:58:19.6876526Z: Closed after exact model-level hash and live
  post-migration schema verification.
