# SB-20260801-005950-incident-closeout-patch-context: Incident closeout patch used stale context

- **Status:** closed
- **First observed:** 2026-08-01T00:59:50.3477440Z
- **Last observed:** 2026-08-03T01:16:19.3458619Z
- **Phase/task:** Phase B Task 8 reconnect-state and rollback closeout maintenance
- **Environment:** Local setback-ledger editing
- **Version/commit:** `e283410`

## Symptom

An incident-closeout patch used stale multi-file context and was rejected
atomically before any edit was applied.

## Impact

Two resolved incidents remained marked contained for one additional step. No
implementation, Git, or provider state changed.

## Reproduction conditions

Apply one multi-file patch using stale or encoding-altered context from several
independent incident records.

## Safe evidence

Exact patch verification rejected every mismatched hunk atomically before a
file write.

## Attempts and outcomes

- The broad multi-file patches failed exact context validation.
- Independent minimal-context patches based on current UTF-8 text succeeded.

## Cause classification

- **Confirmed cause:** Patch context was stale or encoded differently from the
  current incident files.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No partial repository edit occurred.
- **Known exclusions:** No implementation, Git history, provider, credential,
  database, calendar, or key state changed.

## Correction and prevention

- **Correction:** Read each exact incident tail and apply smaller patches.
- **Prevention:** Close independent incidents with independent minimal-context
  patches.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The replacement patches updated the intended incident statuses and matching
index rows, and later UTF-8-aware minimal patches completed successfully.

## Recurrence history

- 2026-08-01T00:59:50.3477440Z: First observed.
- 2026-08-02T03:20:13.4599351Z: Recurred when one multi-file ledger patch
  failed exact index-line verification and was rejected before any edit. The
  replacement uses independent minimal-context patches; no application,
  repository, or provider state changed during the failed patch.
- 2026-08-02T03:21:33.7981111Z: The recurrence update initially overwrote the
  original detection timestamp instead of adding a last-observed field. The
  metadata was corrected before commit; application and provider state were
  unaffected.
- 2026-08-02T03:29:25.8327801Z: Recurred when a multi-file recurrence patch
  copied mojibake instead of the incident's UTF-8 punctuation and failed exact
  verification. The patch was rejected before any edit; narrower UTF-8-aware
  patches replaced it without application or provider effects.
- 2026-08-02T05:32:26.8942986Z: Recurred when a broad ledger patch assumed one
  index row matched the incident metadata exactly. Verification rejected the
  entire patch before any write. Current-line discovery and smaller incident
  and index patches then succeeded; no application or external state changed.
- 2026-08-02T05:38:05.1530859Z: Recurred when the ignored evidence append
  copied one incorrect noun from the current tail. Verification rejected the
  patch before any write. Reading the exact tail and matching only its final
  line allowed the privacy-safe append to succeed without external mutation.
- 2026-08-02T05:42:06.7001385Z: Recurred when an incident-content patch and
  index update were combined while the index used different current phase
  wording. Verification rejected the patch atomically. Incident contents and
  exact discovered index lines are now updated in separate operations.
- 2026-08-02T23:10:35.7052170Z: Recurred when one multi-file rollback closeout
  patch used a stale progress-paragraph context. Verification rejected the
  whole patch before any edit. Current exact tails were reread, and the
  replacement uses independent minimal-context patches.
- 2026-08-03T01:16:19.3458619Z: Recurred when a multi-file closeout patch used
  an incorrect line wrap in the redeploy-review incident. Verification rejected
  the whole patch before any edit. Exact files were reread, and the replacement
  uses smaller current-context patches; no provider or implementation state
  changed.
- 2026-08-03T19:45:00Z: Recurred when a seven-incident closeout patch assumed
  an exact current sentence that differed from the file. Verification rejected
  the patch atomically before any edit. The replacement uses one file and
  narrow current-field edits at a time; no provider or implementation state
  changed.
