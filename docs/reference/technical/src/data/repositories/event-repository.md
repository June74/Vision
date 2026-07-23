# `src/data/repositories/event-repository.ts`

`EventRepository` connects the reviewed generic protected-field encryption API to event persistence. `PlaintextEvent`
extends the pure `VisionEvent` planning contract with the five represented protected fields. `StoredEventRow` replaces
those values with serialized `CipherEnvelope` byte arrays and records the common active key version.

`DrizzleAtomicEventStore` is the production Neon/Drizzle implementation of `AtomicEventStore`. It separates an atomic
strictly-monotonic provider-version save, a projection that cannot select protected columns, and a protected projection
pinned to both node and provider versions. PGlite integration tests execute the same SQL against the reviewed migration.

## `save`

**Signature:** `(event: PlaintextEvent) => Promise<void>`

Strictly validates the complete plaintext object, creates a planning-only object, and calls
`encryptProtectedFields` once with `{ ownerId, nodeId, domain }`. The field names become AES-GCM additional
authenticated data. Attendees are JSON-encoded only after dense string-array validation. Every encryption completes
before `saveAtomically` is called. The returned authoritative row must preserve owner and stable provider identity and
must not be older than the request.

## `getPlanning`

**Signature:** `(nodeId: string) => Promise<VisionEvent | undefined>`

Calls only `selectPlanningEvent`, validates the pure `VisionEvent` result, and checks its owner against the repository's
authenticated owner scope. It has no access to envelope fields.

## `get`

**Signature:** `(nodeId: string) => Promise<PlaintextEvent | undefined>`

Obtains the planning projection, asks the injected server policy to issue a private-symbol-branded owner/privacy
decision, and verifies that decision before calling `selectProtectedEvent`. The protected call is pinned to node and
provider versions. Owner, version, domain, and privacy must still match before envelope parsing, key lookup, or
decryption. Missing or changed snapshots raise
`EventReadStaleError`; denied privacy raises `EventContentAccessDeniedError`.

## `validatePlaintextEvent`

**Signature:** `(event: PlaintextEvent) => PlaintextEvent`

Requires a plain object with exact enumerable data properties, every required field, nullable protected strings, and
a dense attendee array. The remaining fields must pass strict `VisionEventSchema` validation. No coercion occurs.

## `toPlanningEvent`

**Signature:** `(event: PlaintextEvent) => VisionEvent`

Uses explicit protected-field removal to produce the database planning projection.

## `toStoredEventRow`

**Signature:** `(event: VisionEvent, encrypted: EncryptedProtectedEventFields) => StoredEventRow`

Requires one common key version, encodes every envelope to a `Uint8Array`, and constructs the only row type accepted by
the atomic store. The required attendee envelope makes the key-version invariant explicit even when nullable text is
absent.

## `encodeEnvelope`

**Signature:** `(envelope: CipherEnvelope | null) => Uint8Array | null`

Uses the bounded validated `serializeCipherEnvelope` function and UTF-8 encodes the result for PostgreSQL `bytea`.

## `decodeEnvelope`

**Signature:** `(envelope: Uint8Array | null) => CipherEnvelope | null`

Rejects non-binary values and uses fatal UTF-8 decoding plus the bounded strict envelope parser. It returns only after
the repository authorization gate selected the row.

## `toEncryptedProtectedFields`

**Signature:** `(row: StoredEventRow) => EncryptedProtectedEventFields`

Parses the five stored envelopes, requires attendees, and verifies every represented envelope agrees with
`protectedKeyVersion`.

## `validateAuthoritativeSave`

**Signature:** `(authoritative: StoredEventRow, requested: StoredEventRow) => void`

Rejects a storage result that crosses node, owner, stable provider identity, or monotonic version boundaries. Errors
use constant text and do not include row values.

## `matchesAuthorizedSnapshot`

**Signature:** `(stored: StoredEventRow, authorized: VisionEvent) => boolean`

Compares node, owner, version, domain, and privacy. These are the identity, cryptographic key partition, and policy
facts that must remain unchanged between planning authorization and protected selection.

## `validateOpaqueLookup`

**Signature:** `(nodeId: string, ownerId: string) => void`

Rejects empty or non-string lookup identities before an adapter call.

## `isNullableString`

**Signature:** `(value: unknown) => value is string | null`

Recognizes the only permitted scalar protected text shape.

## `validateAttendees`

**Signature:** `(attendees: readonly string[]) => readonly string[]`

Requires the direct array prototype, data descriptors only, dense numeric indices, and string values, then returns a
plain copy.

## `parseAttendees`

**Signature:** `(serialized: string) => readonly string[]`

Parses authenticated attendee JSON and reuses `validateAttendees`. Any malformed content becomes a constant safe
storage error.

## `saveAtomically`

**Signature:** `(row: StoredEventRow) => Promise<AtomicEventSaveResult>`

Executes one data-modifying CTE. `ON CONFLICT` updates all planning and encrypted columns only when owner and stable node
match and the provider version is strictly newer. The statement classifies `applied`, `equal`, or `newer` and returns
the authoritative joined node/event row.

## `selectPlanningEvent`

**Signature:** `(nodeId: string, ownerId: string) => Promise<VisionEvent | undefined>`

Selects an explicit planning-only column list and never mentions an envelope column.

## `selectProtectedEvent`

**Signature:** `(nodeId, ownerId, expectedVersion, expectedProviderVersion) => Promise<StoredEventRow | undefined>`

Selects encrypted columns only after authorization and includes owner, node-version, and provider-version predicates in
the same PostgreSQL statement.

## `assertIdempotentReplay`

**Signature:** `(stored: StoredEventRow, requested: PlaintextEvent) => Promise<void>`

Reissues and verifies the branded owner/privacy decision, decrypts the authoritative equal-version row, and throws
`EventPersistenceConflictError` unless the complete normalized plaintext event is identical.

## `createEventRepository`

**Signature:** `(database, keyProvider, options) => EventRepository`

Wires `DrizzleAtomicEventStore`, the key provider, the server-supplied authenticated owner, and authorization policy.
The authentication milestone must supply the verified owner; this factory does not authenticate a raw request.

## `databaseRowToPlanningEvent`

**Signature:** `(row: DatabaseEventRow) => VisionEvent`

Maps aliased SQL fields, normalizes timestamps, and validates through `VisionEventSchema`.

## `databaseRowToStoredEvent`

**Signature:** `(row: DatabaseEventRow) => StoredEventRow`

Requires binary attendees and numeric key metadata, then combines the validated planning event with nullable byte
envelopes.

## `decryptStoredEvent`

**Signature:** `(keyProvider, stored) => Promise<PlaintextEvent>`

Decrypts owner/node/domain/field-bound envelopes only after the caller has verified a branded policy decision.

## `storedRowToPlanningEvent`

**Signature:** `(stored: StoredEventRow) => VisionEvent`

Explicitly removes every envelope and key-version persistence column.

## `plaintextEventsEqual`

**Signature:** `(left: PlaintextEvent, right: PlaintextEvent) => boolean`

Compares normalized complete events to distinguish an idempotent replay from an equal-version conflict.
