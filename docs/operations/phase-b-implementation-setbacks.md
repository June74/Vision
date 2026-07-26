# Phase B implementation setbacks

This ledger records unexpected defects and process errors found while implementing Vision Phase B. It contains no secret values, personal identifiers, protected calendar content, authorization codes, tokens, database URLs, or auth-bearing URLs.

Status meanings:

- **Open:** reproduced and not yet fixed.
- **Fix in review:** a fix exists but has not passed independent acceptance.
- **Closed:** fixed, regression-tested, and independently accepted.
- **External gate:** requires an explicitly approved live action or provider configuration.

## AI budget Task 3

### Canonical schema checks missed security-relevant details

- **Status:** Closed in `e9c9d77`.
- **Mistake:** The first schema manifest omitted the partial-index predicate enforcing one in-flight AI request. The privilege check also inspected only a subset of possible SQL `GRANT` forms.
- **Impact:** A future migration could weaken concurrency or add mutation privileges while contract tests remained green.
- **Detection:** Independent review plus deliberate mutation tests.
- **Correction:** Compare normalized partial-index predicates and parse the complete bounded set of AI-table grants, including `ALL`, column-level, multi-target, `PUBLIC`, quoted/schema-qualified, and unparsed forms.
- **Prevention:** Every database security invariant needs a mutation test that proves weakening it fails the canonical contract.

### Browser input was treated as a trusted AI disclosure policy

- **Status:** Closed in `1234d96`, included in final Task 3 acceptance.
- **Mistake:** The first production AI route accepted event facts and `permissions` from the browser, then passed them to a function whose second input was explicitly trusted.
- **Impact:** An authenticated caller could forward arbitrary plaintext and unrelated evidence to the model.
- **Detection:** An authenticated Worker probe captured the unintended provider packet.
- **Correction:** Accept only an opaque event reference and idempotency key; after budget admission, load the authenticated owner's encrypted event and derive disclosure policy in server-controlled code.
- **Prevention:** Trace every “trusted” parameter to its production source. Authentication and Cross-Site Request Forgery protection do not make request-body policy trusted.

### An expired reservation could still dispatch

- **Status:** Closed in `e9c9d77`; independently accepted with zero local findings.
- **Mistake:** `markDispatched` checked status but not whether the lease had expired, and the wrapper reused a timestamp captured before asynchronous context loading.
- **Impact:** A stale request and a replacement request could overlap provider calls, violating the one-in-flight budget rule.
- **Detection:** A real PGlite expiry/interleaving probe.
- **Correction:** Use a fresh monotonic dispatch time, atomically require an unexpired reservation, extend the accepted lease through the provider timeout, and make rejected stale dispatches provider-zero.
- **Prevention:** Any lease transition after an `await` must re-read time and atomically validate ownership, status, generation, and expiry.

## Diagnostics Task 4

### Category correction stranded old-domain ciphertext

- **Status:** Closed by `39f11bb`; the rekey behavior passed fresh review.
- **Mistake:** The first correction changed `nodes.domain` but left event fields and retained provider payload encrypted under the old per-domain key and authenticated-data binding.
- **Impact:** The next event-list read failed to decrypt; partial failures could have stranded protected rows.
- **Detection:** Independent real PGlite read-after-correction reproduction.
- **Correction:** Transactionally re-encrypt every domain-bound event envelope and retained provider payload under an owner-scoped compare-and-swap boundary.
- **Prevention:** Treat a privacy/encryption domain change as a data migration, not a metadata update. Test read-after-change, rollback, retries, and concurrent writers.

### Sync may consume a provider update after losing a correction race

- **Status:** Closed in `5a1f436`; independently accepted with zero local findings. Exact two-session execution remains an approval-gated live check.
- **Mistake:** Sync can materialize old node context, wait behind a correction lock, skip the stale node/event write, and still advance the checkpoint as `unchanged`.
- **Impact:** A newer Google revision could be marked consumed without updating Vision.
- **Detection:** Source/atomic-boundary analysis after the rekey review; exact two-session behavior requires the strongest available interleaving harness because local PGlite exposes one backend.
- **Correction:** Share one lock/snapshot/claim boundary across node, event, run, and checkpoint writes; when correction wins, rebase safely while preserving explicit category or retry without advancing the checkpoint.
- **Prevention:** For multi-table synchronization, test both orders at a barrier after snapshot acquisition and before write/lock acquisition—not only barriers before the SQL begins.

### Existing inferred events fail a normal synchronization refresh

- **Status:** Closed in `5a1f436`; independently accepted with zero local findings.
- **Mistake:** The sync insert candidate preserves `domain_state='inferred'` but drops `model_confidence`, so PostgreSQL checks the invalid candidate before applying `ON CONFLICT`.
- **Impact:** Refreshing an inferred event fails the node constraint and returns a database retry.
- **Detection:** Actual `createSyncRepository` plus PGlite.
- **Correction:** Carry the complete valid category/provenance snapshot through every insert/conflict candidate and test inferred, confirmed, explicit, unresolved, and sparse updates.
- **Prevention:** An upsert candidate must satisfy every table constraint even when the expected path is conflict-update.

## Diagnostic UI Task 5

### Action-required state did not tell the user what to do

- **Status:** Open; remediation in progress.
- **Mistake:** The first UI said the foundation needed attention but did not provide a concrete recovery instruction.
- **Impact:** A truthful status still left the private user unable to act on a failed or disconnected foundation.
- **Detection:** Independent copy/behavior review; the original browser test asserted the vague text instead of the required actionability.
- **Required correction:** Map each safe nonhealthy state to a specific safe next step without leaking internal details.
- **Prevention:** Acceptance tests for operational error copy must assert both the state and an actionable user instruction.

### Async category save dropped keyboard focus

- **Status:** Open; remediation in progress.
- **Mistake:** The category `<select>` was disabled while saving, which removed native focus, and focus was not restored.
- **Impact:** Keyboard users lost their place after a routine correction.
- **Detection:** Independent accessibility review; the original keyboard test asserted height and announcement but not `document.activeElement`.
- **Required correction:** Keep the control focusable with an accessible busy/disabled contract or restore focus after both success and failure, while preventing duplicate writes.
- **Prevention:** For every async control, assert focus continuity, busy state, duplicate-action prevention, success, and failure.

### AI availability browser test covered only the hard stop

- **Status:** Open Minor; remediation in progress.
- **Mistake:** The test name/contract implied budget-state coverage but exercised only the $9.50 hard stop.
- **Impact:** Warning/lower-cost and optional-stop UI copy could regress unnoticed.
- **Detection:** Independent coverage review.
- **Required correction:** Add real browser flows for the $8 warning/Luna-only state and $9 optional-work stop while confirming event viewing remains available.
- **Prevention:** Threshold-based product behavior needs one acceptance case at every boundary, not only the terminal threshold.

## Recovery Task 1

### Initial backup contract passed ordinary tests but missed six boundaries

- **Status:** Fix in review at `830293e`.
- **Mistakes found by independent review:**
  - an all-empty authoritative snapshot exported but did not import;
  - row validation omitted SQL types, checks, and alternate unique identities;
  - noncanonical newline-delimited JSON bytes were accepted;
  - caller mutation across an asynchronous boundary could make the authenticated archive disagree with its manifest;
  - target empty/disposable authorization occurred outside the transaction and was raceable;
  - the archive size limit ran only after substantial memory amplification.
- **Impact:** Valid empty backups could be unusable, malformed rows could reach writes, authenticated archives could be unrestorable, target state could race, and oversized input could consume excessive memory.
- **Detection:** Independent differential, mutation, transaction-race, and allocation probes.
- **Correction:** `830293e` added canonical byte comparison, migration-derived schema validation, stable snapshotting, in-transaction target assertions, early bounds, and database-backed interleavings.
- **Prevention:** Backup acceptance requires adversarial corruption, empty-state, schema-differential, mutation-across-await, target-race, and pre-allocation-bound tests—not only happy-path round trips.

### Timestamp and PostgreSQL text validation still differ from the database

- **Status:** Open; freshly reproduced after `830293e`.
- **Mistake:** The first remediation accepted impossible dates, NUL-containing PostgreSQL text/JSON, noncanonical integers, compared timestamp ordering through JavaScript millisecond precision, accepted lone UTF-16 surrogates, and bounded the written local year without bounding the UTC instant after applying its offset.
- **Impact:** Malformed values, a microsecond-reversed timestamp pair, or boundary strings that become BC/year 10000 can reach `transaction.stage()` even though PostgreSQL rejects, normalizes, fails the corresponding check, or returns an unsupported driver date, violating validation-before-write and byte-preserving restore.
- **Detection:** Differential probe comparing canonical export/decode with actual PGlite insertion.
- **Required correction:** Validate timestamps by exact component/offset parsing with fractional precision, compare instants without `Date` millisecond truncation, bound the post-offset UTC instant, and reject NUL or unpaired surrogate code units recursively before any target write.
- **Prevention:** For every emulated SQL type validator, run accepted/rejected differential cases against PostgreSQL-compatible execution.

## Process

### Concurrent agents shared one Git staging index

- **Status:** Contained before an incorrect commit.
- **Mistake:** One task staged files while another task prepared its commit in the same worktree.
- **Impact:** Unrelated backup files briefly appeared in the AI task's index and had to be selectively unstaged/restaged.
- **Correction:** Serialize commits and stage explicit task paths only.
- **Prevention:** Assign commit priority, inspect `git diff --cached --name-only`, and never use broad staging during concurrent work.

### Concurrent full gates collided in Windows temporary files

- **Status:** Contained; the affected focused suite and the serialized full gate passed.
- **Mistake:** Two complete Vitest runs were allowed to execute simultaneously in one worktree.
- **Impact:** One run hit an SSR-cache atomic-rename error and required a clean rerun.
- **Correction:** Serialize the full repository gate.
- **Prevention:** Assign one full-gate owner; all other agents run focused non-overlapping suites until release.

### A full-gate command used a timeout shorter than the established runtime

- **Status:** Contained; the exact gate was restarted under a ten-minute handle with the same exclusive owner.
- **Mistake:** A later full `pnpm check` invocation used a 120-second shell timeout even though prior complete gates regularly exceeded two minutes.
- **Impact:** The run was terminated during unit tests without an assertion failure and had to restart from the beginning.
- **Correction:** Keep the exclusive gate lock and rerun with enough time to complete.
- **Prevention:** Use the measured full-gate duration plus a safety margin; for this worktree, allow ten minutes and yield progress rather than imposing a two-minute command timeout.

### An inline PowerShell probe created a stray redirection artifact

- **Status:** Contained; the generated untracked file was inspected, logged, and removed.
- **Mistake:** SQL comparison characters inside an inline shell probe were not protected from PowerShell redirection parsing.
- **Impact:** A harmless root-level file named `created_at))` captured the attempted command text and appeared in `git status`.
- **Correction:** Verify the artifact contains no secret or user data, then delete only that exact generated file.
- **Prevention:** Put complex probe code in an existing test file or a safely quoted temporary script, use literal arguments, and inspect `git status` immediately after ad hoc shell probes.

### Transient browser screenshots were reported as persistent evidence

- **Status:** Contained; the independent UI reviewer was asked to recapture both viewports into a stable ignored evidence path.
- **Mistake:** Task 5 reported screenshots under Playwright's `test-results` directory as if they would remain available after later test runs.
- **Impact:** The primary agent could not perform its independent visual inspection from the reported paths because the test runner had cleaned them.
- **Correction:** Recapture the desktop and mobile views during review and verify the files exist before citing them.
- **Prevention:** Store acceptance screenshots in a stable ignored evidence directory, then perform an existence/readability check after the final test command.

### Browser capture left an untracked Chromium debug log

- **Status:** Contained; inspected and removed.
- **Mistake:** The review-only browser capture did not redirect Chromium's GPU diagnostic log to a temporary evidence directory.
- **Impact:** A root-level `debug.log` containing only GPU mailbox warnings appeared in `git status`.
- **Correction:** Confirm the log contains no application, secret, or user data, then delete the exact generated file.
- **Prevention:** Launch review browsers with their logs and profiles rooted in an ignored temporary directory and check the worktree after capture.
