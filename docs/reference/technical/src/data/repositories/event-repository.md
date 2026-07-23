# `src/data/repositories/event-repository.ts`

`EventRepository` connects the reviewed generic protected-field encryption API to event persistence. `PlaintextEvent`
extends the pure `VisionEvent` planning contract with the five represented protected fields. `StoredEventRow` replaces
those values with serialized `CipherEnvelope` byte arrays and records the common active key version.

`AtomicEventStore` separates three capabilities: an atomic monotonic save, a projection that cannot select protected
columns, and a protected projection pinned to the planning version. A production database adapter must compare that
version in the same statement that selects envelopes. This avoids both lost-update behavior and a privacy
time-of-check/time-of-use race.

## `save`

**Signature:** `(event: PlaintextEvent) => Promise<void>`

Strictly validates the complete plaintext object, creates a planning-only object, and calls
`encryptProtectedFields` once with `{ ownerId, nodeId, domain }`. The field names become AES-GCM additional
authenticated data. Attendees are JSON-encoded only after dense string-array validation. Every encryption completes
before `saveAtomically` is called. The returned authoritative row must preserve owner and stable provider identity and
must not be older than the request.

## `getPlanning`

**Signature:** `(nodeId: string, ownerId: string) => Promise<VisionEvent | undefined>`

Calls only `selectPlanningEvent`, validates the pure `VisionEvent` result, and checks its owner and node ID against the
lookup. It has no access to envelope fields.

## `get`

**Signature:** `(nodeId: string, authorization: ProtectedEventReadAuthorization) => Promise<PlaintextEvent | undefined>`

Validates the explicit owner and closed privacy-level capability, obtains the planning projection, and checks privacy
before calling `selectProtectedEvent`. The protected call is version-pinned. Owner, version, domain, and privacy must
still match before envelope parsing, key lookup, or decryption. Missing or changed snapshots raise
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

## `validateReadAuthorization`

**Signature:** `(authorization: ProtectedEventReadAuthorization) => ReadonlySet<PrivacyLevel>`

Requires a plain authorization object, a non-empty explicit owner, and values accepted by `PrivacyLevelSchema`.
Invalid capabilities fail closed as `EventContentAccessDeniedError`.

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
