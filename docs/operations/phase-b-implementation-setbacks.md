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

- **Status:** Closed in `b0a6580`; final Task 5 acceptance has zero findings.
- **Mistake:** The first UI said the foundation needed attention but did not provide a concrete recovery instruction.
- **Impact:** A truthful status still left the private user unable to act on a failed or disconnected foundation.
- **Detection:** Independent copy/behavior review; the original browser test asserted the vague text instead of the required actionability.
- **Correction:** Map each safe nonhealthy state to a specific safe next step without leaking internal details.
- **Prevention:** Acceptance tests for operational error copy must assert both the state and an actionable user instruction.

### Async category save dropped keyboard focus

- **Status:** Closed in `b0a6580`; final Task 5 acceptance has zero findings.
- **Mistake:** The category `<select>` was disabled while saving, which removed native focus, and focus was not restored.
- **Impact:** Keyboard users lost their place after a routine correction.
- **Detection:** Independent accessibility review; the original keyboard test asserted height and announcement but not `document.activeElement`.
- **Correction:** Keep the control focusable with an accessible busy/disabled contract or restore focus after both success and failure, while preventing duplicate writes.
- **Prevention:** For every async control, assert focus continuity, busy state, duplicate-action prevention, success, and failure.

### AI availability browser test covered only the hard stop

- **Status:** Closed in `b0a6580`; final Task 5 acceptance has zero findings.
- **Mistake:** The test name/contract implied budget-state coverage but exercised only the $9.50 hard stop.
- **Impact:** Warning/lower-cost and optional-stop UI copy could regress unnoticed.
- **Detection:** Independent coverage review.
- **Correction:** Add real browser flows for the $8 warning/Luna-only state and $9 optional-work stop while confirming event viewing remains available.
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

- **Status:** Closed in `58816e1`; final independent acceptance has zero findings.
- **Mistake:** The first remediation accepted impossible dates, NUL-containing PostgreSQL text/JSON, noncanonical integers, compared timestamp ordering through JavaScript millisecond precision, accepted lone UTF-16 surrogates, and bounded the written local year without bounding the UTC instant after applying its offset.
- **Impact:** Malformed values, a microsecond-reversed timestamp pair, or boundary strings that become BC/year 10000 can reach `transaction.stage()` even though PostgreSQL rejects, normalizes, fails the corresponding check, or returns an unsupported driver date, violating validation-before-write and byte-preserving restore.
- **Detection:** Differential probe comparing canonical export/decode with actual PGlite insertion.
- **Correction:** Validate timestamps by exact component/offset parsing with fractional precision, compare instants without `Date` millisecond truncation, bound the post-offset UTC instant, and reject NUL or unpaired surrogate code units recursively before any target write.
- **Prevention:** For every emulated SQL type validator, run accepted/rejected differential cases against PostgreSQL-compatible execution.

## Recovery Task 2

### Backup storage configuration did not isolate preview and production

- **Status:** Closed across `4587e4e` and `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** The first Wrangler R2 binding could point preview and production at the same daily object-key namespace.
- **Impact:** Preview exercises could read, overwrite, retain, or purge production backups.
- **Detection:** Independent configuration review before staging.
- **Required correction:** Use independently named preview/production buckets or an equivalently hard environment boundary that cannot be selected from request input.
- **Prevention:** Every durable cloud binding needs an environment-isolation contract test covering both resource identifier and object namespace.

### Restore safety trusted local assertions instead of the database

- **Status:** Closed across `4587e4e` and `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** The restore command accepted caller-supplied preview/disposable/schema claims without independently attesting the connected database target.
- **Impact:** Incorrect flags or a wrong connection could direct destructive restore promotion at a non-disposable database.
- **Detection:** Independent operator-safety review.
- **Required correction:** Query and verify durable target identity/environment/disposable state through the database before staging or promotion; local flags may request intent but cannot attest reality.
- **Prevention:** Destructive tooling must verify target identity from the target system itself and keep that attestation inside the promotion transaction.

### R2 upload verification stopped before manifest validation

- **Status:** Closed across `4587e4e` and `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** The first stored-object verification compared envelope and ciphertext checksums but did not decrypt and validate the backup manifest/format.
- **Impact:** An object could be marked as a successful daily backup while remaining unrestorable under the expected key/manifest contract.
- **Detection:** Independent recovery review.
- **Required correction:** Retrieve, decrypt, and fully validate the stored object through the accepted Task 1 importer boundary before reporting success.
- **Prevention:** “Uploaded” is not “verified backup”; acceptance requires a read-back restore-validation path.

### One foreign R2 object could abort retention

- **Status:** Closed across `4587e4e` and `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** A checksum-less or foreign object returned under the list prefix caused the retention job to fail instead of being safely ignored.
- **Impact:** An unrelated/malformed object could prevent expired valid backups from being purged.
- **Detection:** Independent retention adversarial review.
- **Required correction:** Validate each object independently, skip/quarantine foreign entries with a safe diagnostic, and continue idempotent deletion of eligible valid backups.
- **Prevention:** Batch maintenance must isolate per-item validation failures unless the authoritative listing itself is unavailable.

### The built preview deployment could lose its selected R2 binding

- **Status:** Closed in `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** Environment-isolated R2 bindings were added to the source Wrangler configuration, but the preview workflow deploys the generated `dist/vision/wrangler.json` artifact and the artifact path was not proven to retain the selected preview binding.
- **Impact:** A source-level configuration test could pass while the actual deployable preview Worker lacks the backup bucket binding, causing scheduled backup failure after release.
- **Detection:** Fresh post-commit review traced the real preview workflow through the generated deployment artifact.
- **Required correction:** Add a build/deploy-artifact regression that selects preview exactly as the workflow does and verifies the isolated R2 binding survives generation.
- **Prevention:** Configuration acceptance must inspect the exact artifact and command used by CI, not only the source configuration.

### Restore download did not attest R2 object identity before import

- **Status:** Closed in `6a033d6`; final independent acceptance has zero findings.
- **Mistake:** The operator restore path downloaded the object body but did not require the corresponding R2 head, custom metadata, and native checksum to agree with the requested environment/object before decrypting and importing it.
- **Impact:** A wrong or substituted object body could reach cryptographic validation without first proving it is the intended stored backup object and environment.
- **Detection:** Fresh post-commit review traced the restore downloader separately from the scheduled upload verification path.
- **Required correction:** Retrieve and validate the R2 object head, environment-safe metadata, and native checksum before accepting the downloaded envelope.
- **Prevention:** Every recovery read path must repeat storage-layer identity and integrity checks; verification performed during upload is not inherited by a later restore.

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

- **Status:** Recurred once during Recovery Task 2; both runs were restarted under a ten-minute handle with the same exclusive owner.
- **Mistake:** Two later full `pnpm check` invocations used a 120-second shell timeout even though prior complete gates regularly exceeded two minutes and the ten-minute rule had already been recorded.
- **Impact:** Each run was terminated during unit tests without an assertion failure and had to restart from the beginning.
- **Correction:** Keep the exclusive gate lock and rerun with enough time to complete.
- **Prevention:** The full-gate owner must set at least 600 seconds before launching; this is a launch precondition, not a suggestion. Yield progress from the long-running handle instead of imposing a two-minute command timeout.

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

- **Status:** Recurred once during final re-review; both artifacts were inspected and removed. The lifecycle fix must redirect browser diagnostics before acceptance.
- **Mistake:** The review-only browser capture did not redirect Chromium's GPU diagnostic log to a temporary evidence directory.
- **Impact:** A root-level `debug.log` containing only GPU mailbox warnings appeared in `git status`.
- **Correction:** Confirm the log contains no application, secret, or user data, then delete the exact generated file.
- **Prevention:** Launch review browsers with their logs and profiles rooted in an ignored temporary directory, set the browser log destination explicitly, and check the worktree after every capture. A repeated root log means the prevention is not yet implemented.

### Browser tests printed success but the web-server wrapper did not exit

- **Status:** Closed across `050afdc` and `35f97df`; final Task 5 acceptance has zero findings.
- **Mistake:** Initial Task 5 verification reported browser suites as green from their individual `ok` lines without preserving the fact that the Wrangler/Vite web-server wrapper later timed out with exit code 124.
- **Impact:** The assertions passed, but the standard acceptance command is not cleanly automatable and the reported evidence overstated completion.
- **Detection:** Fresh independent re-review ran both focused 18-case and full 29-case suites; each printed all tests as `ok`, then hung until the 180-second harness timeout.
- **Correction:** Use the managed in-process server runner, and make one memoized, bounded termination promise participate directly in the awaited outcome so cleanup rejection, repeated signals, or a child that never exits cannot hang.
- **Prevention:** Acceptance evidence must record the final process exit code, not only per-test output; a nonzero or externally killed test command is not green.

### The task-brief helper assumed Bash was available

- **Status:** Contained; no repository files or external resources were changed by the failed command.
- **Mistake:** The Recovery Task 3 handoff attempted to run the Bash-based `task-brief` helper even though this Windows desktop session could not start `bash.exe`.
- **Impact:** The helper produced no task brief and delayed the handoff by one command.
- **Detection:** PowerShell returned `NativeCommandFailed` before the helper ran.
- **Correction:** Extract the already-reviewed Task 3 requirements with PowerShell-native reads and pass the plan path plus exact task number to the existing implementer.
- **Prevention:** On this workspace, probe a helper runtime before depending on it and prefer PowerShell-native orchestration for local plan artifacts.

### A progress question accidentally paused authorized implementation

- **Status:** Recurred across the Recovery Task 3 handoff and its first replacement; the primary agent took over at the RED step.
- **Mistake:** After reporting the project-progress estimate, the Recovery Task 2 implementer paused instead of continuing the already-authorized remediation. After Task 2 acceptance, both the original Task 3 implementer and its fresh replacement remained active without creating the promised RED files.
- **Impact:** The two new Task 2 findings initially remained without RED regressions, and the next approved local task lost multiple handoff intervals.
- **Detection:** The worktree showed no expected test files and the implementers either confirmed no technical blocker or did not return one within the bounded status window.
- **Correction:** Reassert the standing instruction, interrupt idle runs, and after the second no-progress handoff implement the already-written task directly from the same test-first contract.
- **Prevention:** Treat status questions as additive unless the user clearly cancels or replaces the active task; every implementation handoff must produce a file, test result, or named blocker within its first bounded update, and one replacement is the maximum before local takeover.

### New restore helpers initially lacked complete reference headings

- **Status:** Recurred during the Recovery Task 3 parser remediation; both occurrences were corrected before their final full gates.
- **Mistake:** The first GREEN implementation added verifier/reader helpers without every heading required by Vision's documentation-coverage contract. The later scanner rewrite repeated the omission for six parser/evidence helpers.
- **Impact:** `pnpm docs:check` failed even though the focused behavior tests, real repository scanner, and type check passed.
- **Detection:** The automated documentation validator named the missing helper references.
- **Correction:** Add the missing production JSDoc and matching simple/technical reference headings, then rerun documentation coverage.
- **Prevention:** Treat mirrored reference entries as part of the production-function definition of done; before the first docs run, compare every function added by the diff with both reference heading lists.

### The package runner did not resolve the local Vitest binary

- **Status:** Contained; the same test command succeeded through the repository's explicit local executable.
- **Mistake:** The first Recovery Task 3 RED command used `pnpm exec vitest`, which reported that `vitest` was not recognized even though `node_modules/.bin/vitest.cmd` existed.
- **Impact:** The first test launch failed before Vitest could load the new security suites.
- **Detection:** A read-only binary check confirmed the local command shim existed and `pnpm` itself was available.
- **Correction:** Invoke the explicit repository-local Windows command shim for focused Vitest runs; the normal package scripts remain valid for the full gate.
- **Prevention:** In this Windows worktree, prefer the existing package script or explicit `.cmd` shim for direct tool runs instead of assuming `pnpm exec` updates `PATH` correctly.

### A multi-file patch used stale package context

- **Status:** Contained; no partial files from the rejected patch were written.
- **Mistake:** The first scanner integration patch matched the pre-Task-2 `package.json` script block and omitted the newly added preview-deployment validation entry.
- **Impact:** The patch was rejected and had to be split after rereading the current package/workflow context.
- **Detection:** `apply_patch` failed its expected-line check before changing any target.
- **Correction:** Reread the exact current script block and apply a smaller context-aware patch.
- **Prevention:** After another task commits a shared configuration file, refresh that file immediately before constructing a multi-file patch.

### One forbidden Google surface produced duplicate safe findings

- **Status:** Closed before commit; the focused security suite passes 37/37.
- **Mistake:** The first scanner implementation reported both the forbidden event method and the unapproved adapter-file rule for the same category/file pair.
- **Impact:** CI output remained privacy-safe but duplicated one actionable finding and could make failure counts misleading.
- **Detection:** A test-first uniqueness assertion failed for all five forbidden `calendar.events` mutation methods.
- **Correction:** Deduplicate violations by category and repository-relative file while preserving the first safe reason.
- **Prevention:** Security scanners should define finding identity explicitly and regression-test overlapping detection rules.

### Sandboxed checks could not write optional Wrangler diagnostics

- **Status:** Known environment warning; the complete gate exited `0` and all Worker assertions passed.
- **Mistake:** No application defect was introduced, but Wrangler attempted to write optional diagnostic logs outside the permitted workspace during Worker tests and the production build.
- **Impact:** The output included `EPERM` and static-analysis warnings even though 75 Worker tests, the build, and the security scan completed successfully.
- **Detection:** The final process exit was checked separately from warning text.
- **Correction:** Preserve the passing exit evidence and do not misclassify optional diagnostic-log failure as a test failure.
- **Prevention:** When practical, route Wrangler diagnostics to an approved temporary directory; regardless, acceptance must record both the warnings and final exit code.

## Recovery Task 3

### The client-secret inventory omitted an existing binding

- **Status:** Fix in review; the authoritative inventory and exact schema partition pass focused tests.
- **Mistake:** The first release scanner used a handwritten server-secret list that omitted at least the existing `OPENAI_API_KEY` binding.
- **Impact:** A client bundle containing that server-only binding name could pass the release gate.
- **Detection:** Independent post-commit review compared the scanner list with the actual environment contract.
- **Required correction:** Derive or validate against one authoritative server-only binding inventory and test every current entry.
- **Prevention:** Security inventories must have one source of truth plus a contract test that fails whenever the environment schema adds an unclassified binding.

### The Google allowlist bound endpoints but not HTTP methods

- **Status:** Fix in review; the parser-derived file/endpoint/method allowlist passes focused tests.
- **Mistake:** An approved Google URL passed without proving its exact approved operation, so a non-event `DELETE` against a calendar endpoint could evade the event-specific deny rule.
- **Impact:** Phase B could gain an unapproved provider mutation while the read-only release scan remained green.
- **Detection:** Independent review constructed an allowed-endpoint/wrong-method counterexample.
- **Required correction:** Bind adapter file, statically resolved endpoint family, and exact HTTP method in the allowlist; fail closed when a Google call cannot be resolved.
- **Prevention:** Provider allowlists define operations, not URLs: identity is file plus endpoint plus method.

### Route discovery trusted receiver names and literal paths

- **Status:** Fix in review; parser-derived Hono discovery now includes aliases, constants, `.on`, mounts, and `src/worker.ts`.
- **Mistake:** The first route scanner recognized only receivers literally named `app` or `router` with directly quoted paths.
- **Impact:** Renaming a Hono receiver or moving an event-write path into a constant could bypass the release gate.
- **Detection:** Independent review supplied both bypass shapes.
- **Required correction:** Parse route registrations structurally, resolve bounded string constants, and fail closed for unresolved mutating route paths.
- **Prevention:** Release route checks must consume a canonical/parser-derived manifest, never naming conventions or one regex.

### The Task 3 implementation report was not written

- **Status:** Open process requirement; remediation in progress before re-review.
- **Mistake:** Manual takeover completed the code, RED/GREEN evidence, contamination commands, and full gate but did not write `.superpowers/sdd/recovery-task-3-report.md`.
- **Impact:** The review lacked the brief's durable implementation evidence artifact even though the evidence existed in command output.
- **Detection:** Independent spec-compliance review.
- **Required correction:** Write the report with RED, GREEN, contamination, full-gate, changed-file, self-review, and deferred-live evidence.
- **Prevention:** Treat the task report as part of commit-readiness bookkeeping even when an implementer handoff fails and the primary agent takes over.

### The scanner used the wrong protected canary

- **Status:** Fix in review; the scanner and tests now import the established `VISION_PROTECTED_SENTINEL_7F9A` constant.
- **Mistake:** The first scanner invented a different marker instead of reusing the protected plaintext already exercised by Vision's encrypted-event tests.
- **Impact:** The canonical protected sentinel could appear in a release surface while the central local privacy gate remained green.
- **Detection:** Independent review traced the established canary from the encrypted-event integration contract.
- **Correction:** Export one exact release sentinel and consume it in both the CLI and fixture generator; cover every encoding across client and all five evidence surfaces.
- **Prevention:** Before introducing a security canary, search the repository for the existing contract and import one source of truth.

### Evidence roots did not require the named capture/export

- **Status:** Fix in review; exact filenames and versioned provenance envelopes pass focused tests.
- **Mistake:** The first fail-closed rule accepted any nonempty file under each evidence directory.
- **Impact:** Deleting the intended capture/export and leaving an unrelated clean file could make the release scan pass without evidence.
- **Detection:** Independent review followed the missing-file branch and supplied a junk-file replacement.
- **Correction:** Require each named evidence file, reject substitutions, and validate surface/version/canonical capture time/generator/run/source/record provenance.
- **Prevention:** Evidence gates must identify the artifact, provenance, and schema, not merely a directory.

### Unsafe filenames could be reflected into CI output

- **Status:** Fix in review; unsafe names now become bounded one-way identifiers.
- **Mistake:** The first scanner returned raw repository-relative paths for every finding.
- **Impact:** A filename containing protected text, personal data, a token fragment, or control characters could be echoed even though matched file contents were suppressed.
- **Detection:** Independent safe-output review considered the filename itself untrusted input.
- **Correction:** Permit only a bounded ASCII path grammar with no protected/server-only fragment; replace every other path with a truncated SHA-256 identifier.
- **Prevention:** Sanitize every diagnostic field, including metadata and filenames, not only matched content and exception messages.

### The first parser remediation still used blocklists at two security boundaries

- **Status:** Closed in `b27da3a`; 95 focused security tests and the serialized full gate pass.
- **Mistake:** The first AST rewrite rejected mutating routes only when their path contained lowercase plural `/events`, and it recognized Google HTTP calls through a short list of transport names under two adapter folders.
- **Impact:** Alternative route names, calls outside the adapter folders, and renamed transports could bypass the Phase B no-event-write release gate.
- **Detection:** Final independent review supplied concrete alternative-route and renamed-transport counterexamples.
- **Correction:** Inspect Google operations across all production source, recognize calls by resolved Google endpoint, and require every mutating Hono route to match an exact reviewed file/method/path manifest.
- **Prevention:** A security claim described as an allowlist must be implemented as positive authorization of exact operations, never as a collection of forbidden names or paths.

### Computed SDK members and unsafe source filenames could skip inspection

- **Status:** Closed in `b27da3a`; both reviewer reproductions are permanent passing regressions.
- **Mistake:** The scanner recognized only dot-property Google SDK calls and tested a sanitized diagnostic identifier, rather than the real repository path, to decide whether a source file was TypeScript.
- **Impact:** A bracket-notation event mutation or a source filename requiring safe hashing could avoid AST inspection.
- **Detection:** Final independent review used a computed event deletion and an unsafe filename containing a forbidden event route.
- **Correction:** Resolve fixed dot or bracket members through one AST helper, and use the true repository path for file-type selection while retaining the sanitized identifier only for output.
- **Prevention:** Keep parsing identity separate from diagnostic identity; sanitize at the reporting boundary, not before classification.

### Lowercase percent encoding and self-asserted fixture provenance were accepted

- **Status:** Closed in `b27da3a` for the local Task 3 contract; fresh live capture remains a Task 4 gate.
- **Mistake:** The first remediation generated only uppercase percent encoding and accepted arbitrary bounded provenance strings.
- **Impact:** A case-equivalent protected encoding could pass, and an unreviewed local fixture could describe itself as valid evidence.
- **Detection:** Independent review supplied a lowercase encoding and arbitrary-provenance fixture.
- **Correction:** Scan upper- and lowercase percent encodings and bind every named local fixture to the exact reviewed generator, run identifier, surface, and source identity.
- **Prevention:** Cover equivalent representations explicitly and distinguish deterministic contract fixtures from fresh live operational evidence.

### Static evidence metadata was not proof that the production boundary ran

- **Status:** Closed in `270c3a0`; final independent review returned `READY` with zero findings.
- **Mistake:** The named evidence files still contained reviewer-approved strings authored directly in fixtures. The scanner could prove their shape but not that the logger, audit writer, queue validator, event encryption, or backup encryption had actually produced them for the current build.
- **Impact:** An arbitrary record with the accepted strings could satisfy the release gate without exercising Vision's privacy boundaries.
- **Detection:** Independent review distinguished schema-valid self-assertion from authoritative producer execution.
- **Correction:** Generate all five surfaces immediately before the scan by calling the real production boundaries, bind them to one fresh random run and capture time, hash the exact client build, and write the manifest only after every capture succeeds.
- **Prevention:** Security evidence must be generated by the boundary it claims to test and cryptographically bound to the artifact under review; static fixture labels are test inputs, not release evidence.

### Computed route, SDK, and typed transport properties bypassed the AST allowlist

- **Status:** Closed in `270c3a0`; the final independent re-review returned `READY` with zero findings.
- **Mistake:** The AST scanner initially handled dot-property Hono registrations, fixed SDK bracket members, and identifier transports, but not `app[verb]`, `calendar.events[operation]`, unresolved computed event members, or `this.transport(...)` when the class property was typed as `typeof fetch`.
- **Impact:** A forbidden event route or Google write could be expressed through a computed member or class-held transport while the release scan stayed green.
- **Detection:** Two independent reviews supplied concrete counterexamples; every counterexample first reproduced with zero findings.
- **Correction:** Resolve bounded bracket members through the constant table, fail closed for unresolved computed members on proven Hono/Google receivers, and prove both identifier and typed class-property transports before enforcing the exact provider operation allowlist.
- **Prevention:** Every AST allowlist must test equivalent dot, bracket, alias, constructor-property, and unresolved-expression forms; fail-closed documentation requires permanent regressions for each form.

### Interactive Wrangler login emitted an authorization URL into captured command output

- **Status:** Contained; the expired authorization attempt was not reused and no credential value was requested or copied.
- **Mistake:** The first live-operations login was launched through a command surface whose output is captured, while Wrangler prints its one-time authorization URL before opening the browser.
- **Impact:** An auth-bearing, short-lived URL appeared in tool output even though the project requires those URLs to remain outside captured logs.
- **Correction:** Treat the attempt as expired and switch to a user-controlled browser login without copying its URL.
- **Prevention:** Never run interactive OAuth login commands through captured output. Preflight authentication with a non-interactive status command, then hand off login entirely to a user-controlled browser or terminal.

### Browser discovery returned unrelated and auth-bearing tab URLs

- **Status:** Recurred once during Cloudflare dashboard recovery, then contained; no unrelated tab was claimed or modified.
- **Mistake:** The browser preflight printed the full result of the open-tab listing instead of filtering inside the browser runtime and returning only a safe title/state summary.
- **Impact:** Unrelated browsing URLs and auth-bearing query strings entered tool output unnecessarily.
- **Correction:** Use only the identified Cloudflare tab and avoid re-emitting its URL. After the recurrence, history and tab results were filtered inside the browser runtime before returning only safe Cloudflare state.
- **Prevention:** Filter browser-discovery and history results inside the runtime; never return a raw collection. Return only opaque tab identity, safe title, and the minimum state needed for the next action.

### A grouped verification command hid an earlier documentation failure

- **Status:** Closed; every gate was rerun separately and the later complete `pnpm check` exited `0`.
- **Mistake:** Type checking, documentation, build, and security commands were placed in one PowerShell invocation separated by semicolons. The final successful command made the overall tool result appear successful even though documentation coverage had failed earlier.
- **Impact:** The first combined result could have been misread as a clean verification run.
- **Detection:** The full output was inspected and showed the missing documentation headings despite exit code `0`.
- **Correction:** Add the missing references and rerun type checking, documentation coverage, focused tests, build/security, and the complete gate with independent exit evidence.
- **Prevention:** Do not group acceptance commands with unconditional separators; run each gate separately or use a package script whose conditional chaining preserves the first failure.

### Capture-only callback methods were missing mirrored documentation

- **Status:** Closed before commit; documentation coverage passes.
- **Mistake:** The release-evidence producer documented its exported helpers but omitted JSDoc and simple/technical headings for the injected `append` and `getDataKey` callback methods.
- **Impact:** The first documentation gate failed after the implementation and behavior tests passed.
- **Detection:** The documentation validator named both missing callback methods and all four missing reference headings.
- **Correction:** Add precise callback JSDoc plus mirrored simple and technical reference entries.
- **Prevention:** Include object-literal callback methods when comparing every new production function against Vision's documentation contract.

### The R2 dashboard route was derived from a local browser proxy URL

- **Status:** Contained; no Cloudflare resource or local service was changed by the failed navigation.
- **Mistake:** One navigation attempt derived an R2 path from the controlled tab's current proxy URL instead of the signed-in Cloudflare dashboard history entry.
- **Impact:** The browser attempted a nonexistent local path and returned a connection error, delaying R2 setup.
- **Detection:** The browser reported a local connection refusal before any form or resource action.
- **Correction:** Select the exact signed-in dashboard history entry inside the runtime, validate its Cloudflare host and account-home path, and construct resource navigation from that origin.
- **Prevention:** Browser-control URLs may be proxied; derive provider routes only from a host-validated provider entry, never from the current controlled-tab transport URL.

### Cloudflare R2 requires account-level billing activation

- **Status:** Waiting for user completion of Cloudflare's private billing-address form.
- **Setback:** The preview account had Queue access but R2 was not activated. Cloudflare requires an account-level pay-as-you-go R2 subscription, even though the free tier is displayed.
- **Impact:** The encrypted preview backup bucket and live restore drill cannot be completed until activation.
- **Detection:** The R2 dashboard exposed only an activation action and then displayed billing-address fields.
- **Correction:** Hand the form to the user in Chrome and never request or capture address/payment values; resume with bucket creation after the user completes activation.
- **Prevention:** Preflight managed-service feature activation and billing prerequisites before scheduling live recovery drills.

### Cloudflare tab metadata and a dashboard path exposed private identifiers

- **Status:** Contained; the values were not copied into project files, logs, configuration, or any external message.
- **Mistake:** After reconnecting to Chrome, the safe-summary projection returned the full Cloudflare tab title, which contained the account email. A later filtered snapshot excerpt also retained the account identifier inside a dashboard path.
- **Impact:** Private account metadata appeared in captured tool output even though neither value was needed to verify R2.
- **Detection:** Immediate inspection of the browser-control results showed the unexpected identifiers.
- **Correction:** Subsequent checks returned only fixed booleans for bucket name, privacy, and storage class.
- **Prevention:** Treat page titles and snapshot lines as untrusted private data. Sanitize email patterns and opaque path segments inside the browser runtime, and prefer fixed boolean assertions over returning any provider text or URL fragment.

### A recovery-document lookup guessed a filename that did not exist

- **Status:** Contained; the failed read changed nothing.
- **Mistake:** A local inspection requested `docs/operations/backup-recovery.md` without first listing the actual operations documents.
- **Impact:** One command ended with a file-not-found error after the relevant workflow and deployment validator had already been read.
- **Detection:** PowerShell returned an explicit missing-path error.
- **Correction:** Use the repository file inventory before opening the recovery runbook and rely only on confirmed paths.
- **Prevention:** Search by filename or content before reading a document whose exact path has not been verified.
