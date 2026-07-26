# Recovery Task 3 implementation report

## Status

`DONE`

- Initial implementation commit: `8ebe4b0`
- First review-remediation commit: `4628c59`
- Final operation-manifest remediation commit: `b27da3a`
- Authoritative evidence and structural fail-closed remediation commit: `270c3a0`
- Task 3 itself performed no provider mutation; the approved Task 4 continuation subsequently created the preview Queue and private R2 bucket.

## Scope

- Deterministic local release scanning for protected sentinel encodings across built client assets and five named evidence exports.
- Authoritative client-forbidden runtime-binding inventory.
- TypeScript-AST inspection of Google provider operations and Hono route registrations.
- Safe, non-reflective CI diagnostics.
- Fresh evidence generated through the production logger, audit writer, queue validator, event encryption, and backup encryption boundaries and bound to the exact client build.
- `pnpm security:scan` integration in `pnpm check` and the protected production workflow.

## TDD evidence

### Initial RED

Before the first scanner implementation, the focused security assertions produced 8 expected failures and 1 passing fixture-helper test. The failures covered protected values, missing evidence, forbidden Google event writes and routes, and client secret-binding names.

### Initial GREEN

The first implementation reached 37 focused passing tests and a clean full repository gate. Independent review then found that the first version used the wrong established canary, omitted a current server secret binding, allowed method-level Google bypasses, relied on brittle route-name regexes, accepted unprovenanced evidence placeholders, reflected unsafe filenames, and lacked this report.

### Review-remediation RED

The reviewer findings were converted into regression tests before remediation:

- the new binding-boundary import was initially absent;
- five focused assertions failed for the newly required binding, operation, route, sentinel, and evidence contracts;
- later focused RED runs demonstrated missing `.all` and `.basePath()` route handling before those branches were added.
- final independent review reproductions produced 12 expected failures for
  alternative route naming, source-directory and transport aliases, lowercase
  percent encoding, and provenance authority; two more expected failures covered
  computed SDK members and unsafe source filenames.
- the authoritative-evidence review then produced RED regressions for computed
  Hono methods, computed and unresolved SDK members, renamed transports,
  typed and inferred transport properties, stale captures, and build-digest
  mismatches.

### Final GREEN

- Focused final remediation suite: 3 files, 88 tests passed, 0 failed.
- Complete security suite: 106 tests passed, 0 failed.
- Focused Google/route suite: 1 file, 44 tests passed, 0 failed.
- `pnpm typecheck`: passed.
- `pnpm docs:check`: passed.
- Clean `pnpm security:scan`: passed.
- Final independent review: zero Critical, Important, or Minor findings; `READY`.

## Command-level acceptance

### Protected evidence

A temporary exact established protected canary was added to the named application-log evidence fixture. `pnpm security:scan` exited nonzero and printed only:

- category: `protected-value`
- safe repository-relative evidence path

The canary was removed and the clean scanner passed again.

### Google event write

A temporary Google Calendar event deletion call was added under the inspected adapter source. `pnpm security:scan` exited nonzero and printed only:

- category: `google-event-write`
- safe repository-relative source path

The temporary source was deleted and the clean scanner passed again.

Neither contaminated run printed protected content, OAuth material, provider identifiers, request bodies, or credentials.

## Full repository gate

Serialized `pnpm check` passed after the final code state:

- TypeScript checks: passed.
- Unit/integration: 610 passed, 1 skipped.
- Contract: 179 passed.
- Worker: 75 passed.
- Documentation coverage: passed.
- Production build and crypto-boundary validation: passed.
- Release security scan: passed.

The known sandbox-only Wrangler log-file and static-analysis warnings remained non-fatal; the Worker suite and production build both exited successfully.

## Files changed

The initial implementation commit added:

- `.github/workflows/production.yml`
- `package.json`
- `vitest.config.ts`
- `scripts/scan-release.ts`
- mirrored simple and technical scanner documentation
- three security test files and their fixture helper
- five named local evidence fixtures

The review remediation added or changed:

- `src/server/client-binding-boundary.ts`
- mirrored simple and technical binding-boundary documentation
- `scripts/scan-release.ts`
- the security tests and fixture helper
- the five named evidence fixtures with versioned provenance
- mirrored simple and technical scanner documentation
- this implementation report

The final authoritative-evidence remediation added or changed:

- `scripts/capture-release-evidence.ts`
- generated `dist/release-evidence` inputs ignored by Git
- fresh manifest and client-build digest enforcement
- typed, inferred, bound, and structurally provider-bound transport handling
- computed Hono and Google member fail-closed handling
- new producer, freshness, build-binding, and transport regressions
- mirrored simple and technical producer/scanner documentation

## Self-review

- The exact established canary is centralized and exercised as plain, percent-encoded, base64, base64url, and byte-equivalent data across every required inspection surface.
- Evidence targets are generated immediately before every scan by the real production privacy boundaries. Every record must match one fresh random run, capture time, exact per-surface source identity, and the SHA-256 digest of the client build under review; the manifest is written only after all five producers succeed.
- Client binding checks derive from one source-owned inventory that is compared against every current runtime schema binding, including the AI provider key.
- Google operations are inspected across all production source and allowlisted by exact adapter file, endpoint family, and HTTP method. Unresolved provider calls fail closed through explicit, aliased, typed, inferred, bound, class-property, and structurally provider-marked HTTP transports.
- Event mutations are detected through direct calls, dot/bracket computed members, unresolved collection members, method aliases, event-object aliases, renamed HTTP transports, and direct HTTP operations.
- Hono route inspection covers renamed receivers, static constants, computed method names, unresolved computed methods, Worker-entrypoint routes, `.all`, `.on`, `.route`, `.mount`, and direct or chained `.basePath()` composition. Every mutating route must match the exact reviewed file/method/path manifest.
- Diagnostics contain only categories and safe file identifiers; unsafe names become truncated one-way hashes without disabling AST inspection.
- Scanner execution is local and deterministic and performs no network call or external write.
- `git diff --check` reported no whitespace errors.

## Deferred evidence

Task 3 now produces authoritative local application-log, audit, queue, encrypted-database-row, and encrypted-R2 evidence through production code. Live deployed Queue, Neon, and R2 acceptance remains Task 4 and must be recorded separately without fabricating provider evidence.
