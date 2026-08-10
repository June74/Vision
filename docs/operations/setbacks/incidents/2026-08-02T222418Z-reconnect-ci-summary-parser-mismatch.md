# SB-20260802-222418-reconnect-ci-summary-parser-mismatch: Candidate CI summary parser missed Vitest aggregates

- **Status:** closed
- **First observed:** 2026-08-02T22:24:18.461308Z
- **Last observed:** 2026-08-02T22:25:40.4919578Z
- **Phase/task:** Phase B OAuth reconnect Task 5 immutable-candidate CI reporting
- **Environment:** Local ignored CI stdout log captured through `cmd.exe`
- **Version/commit:** candidate `c1911f8`

## Symptom

The safe aggregate parser found the browser pass count but matched zero Vitest summary rows in the successful captured CI log.

## Impact

The CI exit and immutability verdict remain valid, but fresh Vitest counts are withheld until the log format is diagnosed without printing raw output.

## Reproduction conditions

Parse the successful candidate CI stdout as ordinary text with an ANSI-stripped
regular expression that expects `Tests N passed`.

## Safe evidence

The durable result file matched exact candidate, zero CI exit, passing state,
and tracked cleanliness. The browser aggregate was 36 while the Vitest match
count was zero. No raw log content or private value was displayed.

## Attempts and outcomes

- The zero-match aggregate was withheld instead of being reported as zero
  tests.

## Cause classification

- **Confirmed cause:** Windows PowerShell 5 did not interpret the newer
  backtick-e escape literal, so the first parser failed to remove ANSI control
  sequences between the summary labels and numbers.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** CI failure; the native exit and immutable result
  file are independently zero/true.
- **Known exclusions:** No provider, credential, key, database, calendar,
  source, commit, or deployment state is involved.

## Correction and prevention

- **Correction:** Inspect only byte-order/encoding metadata and sanitized lines
  containing summary labels, then adapt the aggregate parser.
- **Prevention:** Validate the capture format with one known summary marker
  before relying on aggregate extraction.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Using the actual escape character and extracting only numeric/status tokens
returned three Vitest summaries: 1,756 passed with 6 skipped, 183 passed, and
116 passed. The independent browser extraction returned 36 passed. No raw log
line was displayed.

## Recurrence history

- 2026-08-02T22:24:18.461308Z: First observed.
- 2026-08-02T22:24:31.3880067Z: Contained before any incorrect count claim.
- 2026-08-02T22:25:40.4919578Z: Closed after the encoding-safe parser returned
  the expected aggregate suites without exposing raw output.
