Status: DONE

## Checkpoints

- Requirements loaded: Task 3 brief, controller resolutions, and binding plan
  lines 309-431.
- Base boundary: branch `codex/phase-b-foundation`, commit `36f9df2`.
- Scope: multi-file temporary preview acceptance feature; no migration, new
  secret, public operator route, provider mutation, or Google event-write
  capability.
- Privilege mapping: the validator will compare live aggregate role, schema,
  table, column, owner, effective privilege, grant-option, and `PUBLIC` grant
  facts against one manifest. Exact per-table privilege values remain
  controller-attestation-gated and will not be invented.
- TDD state: production code unchanged; focused RED tests are next.
- RED tests created:
  `tests/unit/domain/phase-b-privilege-manifest.test.ts`,
  `tests/integration/data/phase-b-foundation-probe.test.ts`, and
  `tests/integration/jobs/phase-b-foundation-probe.test.ts`.
- Required `pnpm.cmd exec vitest` invocation could not resolve the local Vitest
  executable in this Windows worktree. The repository-declared equivalent
  `pnpm.cmd test:unit` was run with the same five file arguments.
- RED verified: three suites failed only because the three required production
  modules do not exist; both existing safe-tail suites passed, with 38 passing
  tests and zero assertion failures outside the expected missing modules.
- Expanded GREEN checkpoint: the five focused files pass 102 tests with zero
  failures. Covered comparator exactness, live-attestation admission, aggregate
  database facts, owner-scoped sentinel cardinality, plaintext zeroization,
  max-one client lifecycle, bounded R2 listing and backup envelope validation,
  numeric admission, deterministic evidence categories, hostile safe-tail
  shapes, mixed/duplicate records, and foundation-only output mode.
- Initial implementation checkpoint: the privilege manifest is isolated in
  `src/domain/operations/phase-b-privilege-manifest.ts` and its production
  value remains deliberately `undefined`. Source construction rejects it
  before database or R2 access until the controller supplies a complete
  live-attested role, schema, schema-owner, schema-privilege, schema-grant, and
  ordered 29-table contract.
- Database checkpoint: the source uses one max-one retained client, two
  parameterized read-only queries, no row locks, null-safe relation/schema
  resolution, owner-scoped aggregate checks, exact provider identity/revision
  structure, bounded sentinel cardinality, and cleanup on every outcome.
- Storage checkpoint: R2 capability is list/get only; traversal is capped at
  100 pages, 10,000 objects, and `Number.MAX_SAFE_INTEGER` bytes. The
  required-date object must have exact metadata, accepted key version 1,
  matching native/body/ciphertext digests, a valid parsed envelope, and no
  fixed marker bytes. No backup encryption key is read or parsed.
- Scheduler checkpoint: only a typed injected `foundationProbe` boundary was
  added. Existing cron routing is unchanged, and focused tests prove every
  committed cron leaves the candidate boundary unreachable.
- Final focused verification:
  `pnpm.cmd test:unit tests/unit/domain/phase-b-privilege-manifest.test.ts
  tests/integration/data/phase-b-foundation-probe.test.ts
  tests/integration/jobs/phase-b-foundation-probe.test.ts
  tests/unit/scripts/safe-tail-classifier.test.ts
  tests/unit/scripts/print-safe-tail.test.ts
  tests/integration/jobs/daily-backup.test.ts` passed 6 files and 115 tests.
- Full unit verification: `pnpm.cmd test:unit` passed 72 files and 861 tests,
  with one existing skipped file/test and zero failures.
- Required gates: `pnpm.cmd typecheck`, `pnpm.cmd docs:check`, and
  `pnpm.cmd security:scan` all passed. The release security scan reported
  fresh evidence and passed.
- Structural gates: migration diff is empty and `git diff --check` passed.
- Self-review corrections: schema and table privilege checks now resolve
  missing objects without turning mismatches into provider errors; all schema
  owner/privilege/grant expectations enter the aggregate query; Google event
  provenance checks include calendar identity, event identity, and provider
  revision; the required date uses the intrinsic ISO conversion.

## Historical controller-gated context (superseded)

- Before the live-attestation resolution below, exact deployed privilege facts
  had not been supplied. They could not be inferred from repository call sites,
  so the production manifest was unavailable and no live privilege-success
  claim was made.
- Independent database/security review was deferred until the controller
  supplied and separately attested the privilege contract.

## Independent-review fix wave

- Scope: resolved Important findings 2 and 3 and Minor finding 1 from
  `.superpowers/sdd/acceptance-task-3-review.md`. The production privilege
  manifest and all live privilege values remain unchanged.
- Raw database storage: the unique admitted sentinel now checks the raw
  `title_envelope` bytes for the fixed public marker before title decryption.
  Only the derived absence boolean contributes to
  `protectedStorageMatches`; the decrypted title still determines
  `sentinelStatus`, and every application-controlled plaintext buffer remains
  cleared in `finally`.
- Schema binding: the source admits only the fixed production application
  schema, and every application relation in both SQL statements is statically
  qualified with that schema. Tests cover every `nodes`, `edges`, `events`,
  and `sync_checkpoints` occurrence and reject unqualified reads, making the
  result independent of `search_path`.
- Numeric evidence: safe-tail accepts `numeric_bound_exceeded` only when at
  least one numeric field is zero, which is the exact observable condition
  created when the job sanitizes a rejected integer. The job test proves the
  rejected field becomes zero even when every other numeric field is positive.
- RED command:
  `pnpm.cmd test:unit tests/integration/data/phase-b-foundation-probe.test.ts
  tests/integration/jobs/phase-b-foundation-probe.test.ts
  tests/unit/scripts/safe-tail-classifier.test.ts`.
  Output: 2 failed files, 1 passed file; 4 expected failed tests and 80 passed
  tests. The failures were schema admission, static relation qualification,
  raw-envelope marker absence, and impossible numeric evidence.
- First GREEN command: the same three-file command.
  Output: 3 passed files, 84 passed tests, zero failures.
- Final covering command:
  `pnpm.cmd test:unit tests/integration/data/phase-b-foundation-probe.test.ts
  tests/integration/jobs/phase-b-foundation-probe.test.ts
  tests/unit/scripts/safe-tail-classifier.test.ts
  tests/unit/scripts/print-safe-tail.test.ts`.
  Output: 4 passed files, 98 passed tests, zero failures.
- `pnpm.cmd typecheck` output:
  `tsc --noEmit && tsc --noEmit -p tests/tsconfig.json`; exit 0.
- `pnpm.cmd docs:check` output:
  `tsx scripts/validate-doc-coverage.ts`; exit 0.
- `pnpm.cmd security:scan` output:
  `Fresh release evidence captured.` and
  `Release security scan passed.`; exit 0.
- `git diff --check` passed. Migration and
  `src/domain/operations/phase-b-privilege-manifest.ts` diffs are empty.

## Historical remaining concern after review fixes (resolved)

- At that checkpoint, the sole remaining concern was the controller-gated live
  privilege contract. `PHASE_B_PRIVILEGE_MANIFEST` was deliberately
  unavailable, so source construction rejected before I/O and no live
  privilege-success claim was made.

## Live privilege attestation resolution

- The corrected controller attestation passed the closed structural checks:
  the application role matched, all 29 required tables were present, every
  table used the same non-application owner, `PUBLIC` had zero table grants,
  and the complete attestation was structurally valid.
- Strict RED:
  `pnpm.cmd test:unit
  tests/unit/domain/phase-b-privilege-manifest.test.ts` failed exactly one of
  nine tests because the production manifest was still unavailable; the other
  eight manifest tests passed.
- Production GREEN: the exact reviewed attestation is encoded explicitly in
  `PHASE_B_PRIVILEGE_MANIFEST`, including the ordered 29-table contract. The
  manifest, nested table objects, privilege arrays, and grant-option arrays
  are frozen at runtime, with direct deep-immutability coverage. No attested
  value was inferred or normalized.
- Exact-manifest GREEN: the same focused manifest command initially passed one
  file and all 9 tests; the settled suite passes 10 manifest tests after adding
  direct deep-immutability coverage.
- Final Task 3 regression:
  `pnpm.cmd test:unit tests/unit/domain/phase-b-privilege-manifest.test.ts
  tests/integration/data/phase-b-foundation-probe.test.ts
  tests/integration/jobs/phase-b-foundation-probe.test.ts
  tests/unit/scripts/safe-tail-classifier.test.ts
  tests/unit/scripts/print-safe-tail.test.ts
  tests/integration/jobs/daily-backup.test.ts` passed 6 files and 120 tests.
- Required gates passed on the settled source: `pnpm.cmd typecheck`,
  `pnpm.cmd docs:check`, `pnpm.cmd security:scan`, `git diff --check`, and an
  empty migration diff.
- The initial compile gate identified TypeScript widening inside nested frozen
  literals. Typed freeze helpers now preserve the closed table contract, and
  the complete literal uses `satisfies PhaseBPrivilegeManifest`; no type
  assertion or attested-value change was required.
- Independent read-only re-review found no remaining Critical, Important, or
  Minor issue after the typed-freeze and historical-report corrections.
- The live attestation file was read only and left unchanged. The prior
  controller-gated concern is resolved; no remaining Task 3 concern is known.
