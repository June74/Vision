# `src/data/repositories/diagnostic-repository.ts`

The factory accepts only a verified server-issued event capability and derives the fixed owner from it, so operations cannot supply or switch owners. Operational SQL returns only counts, states, and timestamps. Event listing authorizes planning facts before selecting encrypted titles. Category correction decrypts and re-encrypts all domain-bound event and retained provider-payload fields without returning them to the API.

## `readFoundationFacts`

Uses scalar owner-scoped PostgreSQL aggregates to read the newest Google Calendar checkpoint, latest successful Google sync, oldest open Google job, maximum open retry count, failed-job count, active Google channel expiry, OAuth-token presence, and settled-plus-reserved current Chicago-month cents. Explicit provider predicates prevent unrelated future integrations from changing Google health. Usage-warning booleans are injected from the release-monitoring boundary.

## `listEvents`

Selects at most 200 active owner planning rows ordered by start and opaque node ID. Each row passes through `authorizePlanningEvent`; only then does `readAuthorizedDiagnosticEvent` pin node version, provider version, domain, privacy, and state while selecting the title envelope.

## `correctCategory`

Uses a bounded retry loop over an authorized planning snapshot, exact protected snapshot, old-domain decryption, target-domain encryption, and one atomic compare-and-swap statement. The statement locks the node, event, and retained payload rows; compares provider identity/version, schedule facts, every event envelope, every key-version column, and payload presence/bytes; then updates event and provider-payload envelopes, node category/version, and explicit assignment together. A sync that wins first forces correction to reload and re-encrypt its newer provider snapshot. A correction that wins first makes stale sync context fail. No Google adapter is reachable.

## `authorizePlanningEvent`

Builds the exact authenticated-owner, event-owner, and privacy request and accepts it only when `matchesEventContentAuthorizationDecision` verifies the server-issued decision.

## `readAuthorizedDiagnosticEvent`

Selects only the title and row key version after authorization, with owner, node version, provider version, domain, state, and privacy pins. It decrypts the title under exact owner/node/domain authenticated metadata.

## `readCorrectionPlanningSnapshot`

Selects no protected columns. It reads node/category authority, provider identity/version, schedule, privacy, and optional assignment facts for one active owner event.

## `readCorrectionProtectedSnapshot`

Pins every planning fact before selecting the five event envelopes, event key metadata, and optional retained provider-payload envelope/key metadata.

## `decryptCorrectionSnapshot`

Decrypts event fields with their original domain AAD and decrypts the retained payload under field name `providerPayload`. A malformed envelope or metadata mismatch fails before mutation.

## `prepareCorrection`

Encrypts the preserved plaintext under the target-domain key/AAD. All event fields share one active key version; an existing provider payload is independently re-encrypted and remains required.

## `applyCorrection`

Uses materialized locking CTEs and exact byte comparisons. Event and provider-payload envelopes are updated before the node domain becomes visible in the same atomic statement; assignment upsert is driven only by the successful fenced writes.

## `decodePlanningEvent`

Strictly decodes the planning-only owner, provider version, schedule, domain/state, privacy, node version, and category provenance.

## `decodeCorrectionPlanningSnapshot`

Extends the planning row with provider identity, busy/recurrence facts, node provenance, and an all-null-or-complete assignment tuple.

## `decodeCorrectionProtectedSnapshot`

Copies bounded `bytea` values and requires provider payload envelope and key metadata to be both present or both absent.

## `decodeCorrectionEventEnvelopes`

Parses the five event envelopes and checks every represented envelope against the event row key version.

## `decodeCheckedEnvelope`

Parses one bounded serialized envelope and rejects embedded/row key-version disagreement.

## `requireOneEnvelopeVersion`

Requires exactly one key version across non-null protected event fields and can also pin it to expected row metadata.

## `isIdempotentCorrection`

Treats a correction as a no-op only when node and assignment both already record the same confirmed user category at the current node version, after current-domain ciphertext has successfully decrypted.

## `correctionFromPlanning`

Copies the persisted assignment timestamp, domain, and version into the safe idempotent result.

## `decodeCorrectionResult`

Decodes only the safe ID, concrete domain, timestamp, and positive node version returned by the atomic statement.

## `encodeEnvelope`

Serializes a validated optional envelope as UTF-8 bytes.

## `encodeRequiredEnvelope`

Adds a non-null requirement for attendees and retained provider-payload replacement.

## `nullableByteaSql`

Produces a parameterized `bytea` SQL fragment whose null case remains database null rather than an empty byte string.

## `requiredByteaSql`

Produces a required parameterized `bytea` SQL fragment from bounded hexadecimal transport.

## `bytesToHex`

Rejects empty or oversized ciphertext and encodes only bounded bytes for parameterized PostgreSQL `decode`.

## `createDiagnosticRepository`

**Signature:** `createDiagnosticRepository(database, keyProvider, access, usageWarnings): DiagnosticRepositoryPort`

Requires `isVerifiedEventRepositoryAccess(access)`, derives the owner from the verified capability, validates warnings once, freezes the warning snapshot, and returns the owner-scoped implementation.

## `decodeEnum`

Rejects database values outside the caller-provided immutable allowlist.

## `decodeBoolean`

Accepts only decoded booleans or Neon raw `t`/`f` values.

## `decodeText`

Requires non-empty text within an explicit maximum.

## `decodeDate`

Accepts finite `Date` instances or timezone-bearing PostgreSQL text, including Neon’s compact `+00` offset.

## `decodeNullableDate`

Maps database null/undefined to null and otherwise delegates to `decodeDate`.

## `decodeNonnegativeInteger`

Safely decodes numeric, bigint, or canonical decimal aggregate values.

## `decodePositiveInteger`

Adds a positive constraint for node versions and protected key versions.

## `decodeBytea`

Copies bounded `Uint8Array` values or decodes canonical lowercase PostgreSQL hex. It never serializes ciphertext into an API response.

## `assertDate`

Requires a finite `Date` at repository entry.

## `validateEventId`

Requires a bounded opaque identifier before parameterized correction SQL.

## Covering tests

`tests/integration/data/diagnostic-repository.test.ts` uses all Phase B migrations in PGlite to verify owner isolation, authorized title reads, full event/provider-payload rekey, null-field preservation, crypto-failure rollback, both sync/correction commit orders, two concurrent corrections, and idempotent retry. `tests/unit/crypto/test-provider-boundary.test.ts` proves production diagnostic composition reaches the verified authorization module without importing the private capability registry.
