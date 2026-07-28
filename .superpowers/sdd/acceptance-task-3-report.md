Status: NEEDS_CONTEXT

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
- Final implementation checkpoint: the privilege manifest is isolated in
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

## Remaining context

- Exact deployed privilege facts have not been supplied. They cannot be
  inferred from repository call sites, so the production manifest remains
  unavailable and no live privilege-success claim is made.
- Independent database/security review should use the committed diff after
  the controller supplies or separately attests the privilege contract.
