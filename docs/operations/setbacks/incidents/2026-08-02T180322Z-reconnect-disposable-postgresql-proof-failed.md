# SB-20260802-180322-reconnect-disposable-postgresql-proof-failed: Disposable PostgreSQL reconnect proof failed

- **Status:** closed
- **First observed:** 2026-08-02T18:03:22.667839Z
- **Last observed:** 2026-08-02T18:33:18.5332654Z
- **Phase/task:** Phase B OAuth reconnect recovery Task 2
- **Environment:** Owner-created disposable schema-only Neon branch through the masked local proof runner
- **Version/commit:** `a4376ab` plus the uncommitted Task 2 PostgreSQL proof

## Symptom

The explicitly approved five-case disposable PostgreSQL proof exited nonzero and the masked wrapper reported only its generic safe failure.

## Impact

Task 2 cannot be committed or reviewed until a privacy-safe failure category is captured and the exact cause is corrected.

## Reproduction conditions

Run `.superpowers/sdd/run-approved-oauth-reconnect-postgres.ps1`, provide the
disposable branch connection string only through its hidden prompt, and allow
the opt-in five-case suite to execute.

## Safe evidence

The masked wrapper exited nonzero and emitted its generic approved-proof
failure. The connection string was not placed in chat or a repository file.
The non-approved guard independently exits zero with all five cases skipped.

## Attempts and outcomes

- The first approved disposable-branch proof failed and stopped Task 2 before
  staging or commit.
- No corrective change has been attempted while the exact safe failure
  category remains unknown.
- Static comparison with the existing multi-session acceptance contract found
  that the disposable test role must create and drop its generated schema.
  Earlier owner guidance incorrectly suggested selecting `vision_app` when
  available even though that application role is intentionally
  least-privileged.
- The warning-free full local CI gate passed 1,754 unit/integration assertions
  with six intentional skips, 183 contract assertions, 116 Worker assertions,
  36 browser tests, typecheck, documentation, both builds, and release
  security validation.
- A diagnostic-only capability probe was added under the ignored task
  workspace. Its no-credential guard and PowerShell parser both passed; it
  returns only safe booleans and a closed failure category before any exact
  test retry.
- The owner's first diagnostic run safely returned `local_runner`. A
  file-based synthetic reproducer then confirmed that Windows PowerShell
  promoted captured native stderr into a terminating `NativeCommandError`
  under the wrapper's strict error preference. The ignored wrapper now uses
  `Continue` only around captured native commands and restores strict handling
  immediately afterward.
- The corrected diagnostic then returned `lock_observation`. Its Boolean-only
  preflight had already passed connection, schema-creation capability, and
  self-session visibility, isolating the failure to the multi-session wait
  observation boundary.
- The owner confirmed that connection pooling was enabled and the selected
  connection was identified as a pooler connection. The branch, database, and
  schema-capable role remain unchanged for the one-variable direct-connection
  retry.
- Two attempted synthetic connection-string runs timed out because redirected
  input did not provide a reliable test of the interactive secure prompt. They
  were abandoned without treating their result as evidence; the successful
  file-based reproducer exercised only the native stderr boundary instead.

## Cause classification

- **Confirmed cause:** The diagnostic's `local_runner` result was caused by
  Windows PowerShell native-stderr promotion before the wrapper could inspect
  the probe's safe result. The PostgreSQL lock-observation failure was caused
  by using a pooled Neon connection for a pinned-session harness. The harness
  relies on session-level `search_path` and `application_name`, while Neon's
  PgBouncer transaction mode does not preserve session state across
  transactions. A separate guidance defect is confirmed: the connection
  instructions did not state the direct-session requirement.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** A piped synthetic connection string is not a valid
  reproduction of the owner's interactive secure prompt in this shell; both
  bounded attempts timed out without a safe category.
- **Known exclusions:** The local opt-in guard, TypeScript compilation,
  reconnect repository/Worker behavior, full repository CI, and ordinary
  build/security paths are green. No preview database, deployment, provider,
  key, repository history, or private-data state was changed by this failure.

## Correction and prevention

- **Correction:** Kept the same disposable branch, database, and schema-capable
  role; disabled connection pooling, copied the regenerated direct connection
  string through the Neon UI, and reran the masked Boolean-only diagnostic.
- **Prevention:** State both acceptance capabilities before asking the owner to
  copy a disposable connection string: a schema-capable test role and a direct,
  non-pooled connection. Never infer either from normal runtime guidance.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed. Retain the disposable branch and
  direct connection until the immutable-candidate repeat proof is complete.

## Verification and related work

The diagnostic parses with zero errors. The file-based Windows PowerShell
reproducer proves that strict mode promotes synthetic native stderr and that
the localized `Continue` path preserves the real native exit code. The direct-
connection retry then exited success: all five approved PostgreSQL cases
passed, zero skipped, and every generated schema cleanup completed. No
connection value or private row was recorded.

## Recurrence history

- 2026-08-02T18:03:22.667839Z: First observed.
- 2026-08-02T18:19:27.7091439Z: The first privacy-safe diagnostic returned
  `local_runner`. The native-stderr reproducer proved the wrapper cause, and
  the localized correction passed parser and control-flow verification. No
  connection value, database identifier, role credential, or raw error was
  recorded.
- 2026-08-02T18:26:18.8761196Z: The corrected diagnostic returned
  `lock_observation`. Connectivity, schema capability, and session visibility
  passed; no raw database or provider value was recorded. Connection mode is
  the next bounded fact.
- 2026-08-02T18:31:27.7597831Z: The owner confirmed pooling was enabled and the
  selected connection was the pooler variant. The next run changes only that
  mode to direct and keeps all other disposable-target selections unchanged.
- 2026-08-02T18:33:18.5332654Z: Closed after the one-variable direct-
  connection retry passed all five approved PostgreSQL cases with zero skipped
  and successful generated-schema cleanup. This confirms pooling as the
  lock-observation cause.
