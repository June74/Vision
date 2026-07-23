# Vision Phase B Domain, Data, and Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Vision's authoritative typed graph, deterministic category contract, application encryption, privacy-safe audit records, and 30-day lifecycle.

**Architecture:** Pure domain modules define closed types and rules. Drizzle maps those types into PostgreSQL tables, provider data enters through repository interfaces, and protected values cross the persistence boundary only as authenticated ciphertext envelopes.

**Tech Stack:** TypeScript, Zod, Drizzle ORM, Neon PostgreSQL serverless driver, Web Crypto AES-GCM, Vitest, SQL migrations.

## Global Constraints

- PostgreSQL is the sole transactional source of truth.
- Every node retains owner, provider identity, domain state, privacy, provenance, lifecycle, and version.
- Allowed domains are `school`, `work`, `personal`, and `unresolved`.
- Resolution precedence is explicit user choice, then confirmed source association, then AI inference.
- AI inference cannot lower privacy or authorize sharing.
- Encrypt titles, descriptions, attendees, locations, meeting links, note bodies, upload text, OAuth tokens, and retained AI content before persistence.
- Use per-user/per-domain data keys wrapped by a root Worker secret and record key versions.
- Deleted content remains encrypted and recoverable for 30 days, then is purged.
- Audit records contain privacy-safe facts only.
- For every production file and named function, maintain concise `docs/reference/simple/` and in-depth `docs/reference/technical/` entries at mirrored paths; document meaningful folders with `_folder.md` in both trees.
- Require module/function JSDoc, use inline comments for non-obvious rules and invariants, and run `pnpm docs:check` before every task commit.

---

### Task 1: Define canonical domain contracts

**Files:**
- Create: `src/domain/graph/node.ts`
- Create: `src/domain/graph/edge.ts`
- Create: `src/domain/events/event.ts`
- Create: `src/domain/categorization/category.ts`
- Create: `src/domain/privacy/privacy.ts`
- Test: `tests/unit/domain/category.test.ts`
- Test: `tests/unit/domain/graph.test.ts`

**Interfaces:**
- Produces: `NodeEnvelope`, `Edge`, `VisionEvent`, `Domain`, `DomainState`, `PrivacyLevel`, and Zod schemas.
- Produces: `resolveDomain(inputs): DomainDecision`.

- [ ] **Step 1: Write precedence and graph-invariant tests**

```ts
it("prefers an explicit category over source and AI", () => {
  expect(resolveDomain({
    explicit: "personal",
    confirmedSource: "work",
    inference: { domain: "school", confidence: 0.99 },
  })).toEqual({ domain: "personal", state: "confirmed", basis: "explicit" });
});

it("keeps an ambiguous item unresolved", () => {
  expect(resolveDomain({ inference: undefined })).toEqual({
    domain: "unresolved", state: "unresolved", basis: "none",
  });
});
```

Add graph tests rejecting unknown node types, cross-owner edges, invalid edge families, and an inferred value that reduces privacy.

Run: `pnpm exec vitest run tests/unit/domain/category.test.ts tests/unit/domain/graph.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 2: Implement closed schemas and pure resolution rules**

Define:

```ts
export const DomainSchema = z.enum(["school", "work", "personal", "unresolved"]);
export const DomainStateSchema = z.enum(["confirmed", "inferred", "unresolved"]);
export const PrivacyLevelSchema = z.enum(["planning", "private", "restricted"]);
```

Use discriminated unions for node and edge types. `resolveDomain` must use explicit, confirmed-source, inference, then unresolved precedence; inference returns `state: "inferred"` and its confidence but never changes privacy.

- [ ] **Step 3: Verify pure-domain isolation**

Run:

```powershell
pnpm exec vitest run tests/unit/domain/category.test.ts tests/unit/domain/graph.test.ts
Select-String -Path 'src/domain/**/*.ts' -Pattern 'react|cloudflare|openai|google|drizzle|neon'
```

Expected: tests pass and the import scan returns no matches.

- [ ] **Step 4: Commit domain contracts**

```powershell
git add src/domain tests/unit/domain
git commit -m "feat: define Vision domain contracts"
```

### Task 2: Add PostgreSQL schema and migration verification

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/data/schema/nodes.ts`
- Create: `src/data/schema/events.ts`
- Create: `src/data/schema/edges.ts`
- Create: `src/data/schema/audit.ts`
- Create: `src/data/schema/sync.ts`
- Create: `src/data/schema/index.ts`
- Create: `src/data/db.ts`
- Create: `src/data/repositories/graph-repository.ts`
- Create: `migrations/0001_phase_b_foundation.sql`
- Create: `tests/contract/data/schema.contract.test.ts`
- Modify: `package.json`
- Modify: `src/server/env.ts`

**Interfaces:**
- Produces: `createDb(databaseUrl): NeonHttpDatabase`.
- Produces: `GraphRepository` with `upsertNode`, `upsertEvent`, `replaceEdges`, and `getEventByProviderIdentity`.
- Produces: unique provider identity and governed-edge database constraints.

- [ ] **Step 1: Install database dependencies**

Run: `pnpm add @neondatabase/serverless drizzle-orm && pnpm add -D drizzle-kit`

Expected: dependencies and lockfile update successfully.

- [ ] **Step 2: Write the failing schema contract**

The contract test reads the reviewed SQL migration and asserts it contains primary keys, foreign keys, owner checks, unique `(provider, provider_calendar_id, provider_event_id)`, lifecycle timestamps, monotonic version checks, and an edge-kind constraint.

```ts
expect(sql).toContain("unique (provider, provider_calendar_id, provider_event_id)");
expect(sql).toContain("check (version > 0)");
expect(sql).toContain("foreign key (source_node_id, owner_id)");
```

Run: `pnpm exec vitest run tests/contract/data/schema.contract.test.ts`

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Implement schema and repository transaction boundaries**

Create normalized `nodes`, `events`, `edges`, `audit_events`, `sync_checkpoints`, `sync_channels`, `operation_ledger`, and `recoverable_deletions` tables. Keep protected payload columns as binary ciphertext envelopes; do not use JSON for provider identity or sync tokens. Create the Drizzle schema and repository interface matching the pure domain types.

Use Neon HTTP for one-shot reads and atomic non-interactive transactions. Do not instantiate a privileged database role in client code, and document that production must use a least-privileged application role rather than `neondb_owner`.

- [ ] **Step 4: Verify generated schema does not drift from reviewed SQL**

Run:

```powershell
pnpm exec drizzle-kit generate
git diff --exit-code -- migrations/0001_phase_b_foundation.sql
pnpm exec vitest run tests/contract/data/schema.contract.test.ts
pnpm typecheck
```

Expected: no unexpected generated migration diff; contract and types pass.

- [ ] **Step 5: Commit the data foundation**

```powershell
git add package.json pnpm-lock.yaml drizzle.config.ts src/data src/server/env.ts migrations tests/contract/data
git commit -m "feat: add authoritative graph schema"
```

### Task 3: Implement protected-field encryption and key wrapping

**Files:**
- Create: `src/crypto/envelope.ts`
- Create: `src/crypto/key-provider.ts`
- Create: `src/crypto/protected-fields.ts`
- Create: `src/crypto/test-key-provider.ts`
- Test: `tests/unit/crypto/envelope.test.ts`
- Test: `tests/unit/crypto/protected-fields.test.ts`
- Modify: `src/server/env.ts`

**Interfaces:**
- Produces: `CipherEnvelope { version; algorithm; keyVersion; iv; ciphertext }`.
- Produces: `KeyProvider.getDataKey(ownerId, domain, keyVersion?)`.
- Produces: `encryptProtectedFields` and `decryptProtectedFields`.

- [ ] **Step 1: Write round-trip, tamper, and separation tests**

```ts
const encrypted = await encryptText(key, "private title", aad);
expect(JSON.stringify(encrypted)).not.toContain("private title");
await expect(decryptText(key, { ...encrypted, ciphertext: flipBit(encrypted.ciphertext) }, aad))
  .rejects.toThrow();
```

Add tests showing different domains receive different wrapped data keys and the same plaintext produces different ciphertext because each encryption uses a fresh 96-bit IV.

Run: `pnpm exec vitest run tests/unit/crypto`

Expected: FAIL because crypto modules do not exist.

- [ ] **Step 2: Implement AES-GCM envelopes**

Use Workers Web Crypto AES-GCM with 256-bit keys, 96-bit random IVs, authenticated additional data containing owner ID, node ID, field name, and key version. Serialize binary values as base64url only at JSON boundaries. Wrap per-user/per-domain data keys with the root key binding; never persist the root key.

Reject unknown envelope versions, algorithms, key versions, or mismatched additional data. Make key rotation capable of decrypting old versions and encrypting only with the active version.

- [ ] **Step 3: Run crypto and type verification**

Run: `pnpm exec vitest run tests/unit/crypto && pnpm typecheck`

Expected: all crypto tests pass, including tamper rejection.

- [ ] **Step 4: Commit crypto boundaries**

```powershell
git add src/crypto src/server/env.ts tests/unit/crypto
git commit -m "feat: encrypt protected Vision fields"
```

### Task 4: Add encrypted event persistence and privacy-safe audit

**Files:**
- Create: `src/data/repositories/event-repository.ts`
- Create: `src/audit/audit-event.ts`
- Create: `src/audit/audit-writer.ts`
- Test: `tests/integration/data/encrypted-event.test.ts`
- Test: `tests/unit/audit/audit-event.test.ts`

**Interfaces:**
- Produces: `EventRepository.save(event)` and `EventRepository.get(id)`.
- Produces: `AuditWriter.write(SafeAuditEvent)`.
- Guarantees: repositories receive plaintext domain objects but store ciphertext for protected fields.

- [ ] **Step 1: Write sentinel and audit allowlist tests**

Persist a fixture containing `VISION_PROTECTED_SENTINEL_7F9A` in every protected field. Query raw rows and serialized audit events, then assert the sentinel is absent. Add compile/runtime tests rejecting `title`, `description`, `noteBody`, `attendees`, `token`, and `content` as audit keys.

Run: `pnpm exec vitest run tests/unit/audit tests/integration/data/encrypted-event.test.ts`

Expected: FAIL because repository encryption and audit writer are absent.

- [ ] **Step 2: Implement encryption at the repository boundary**

Before insert/update, split planning-safe fields from protected fields, encrypt each protected field with field-specific additional data, and store envelopes. Decrypt only after owner and privacy checks. Write audit facts using opaque IDs, action, actor type, timestamp, outcome, provider, and error category.

- [ ] **Step 3: Verify raw storage and logs**

Run: `pnpm exec vitest run tests/unit/audit tests/integration/data/encrypted-event.test.ts`

Expected: tests pass and raw database/audit output contains no sentinel.

- [ ] **Step 4: Commit protected persistence**

```powershell
git add src/data/repositories src/audit tests/unit/audit tests/integration/data
git commit -m "feat: protect persisted event content"
```

### Task 5: Implement recoverable deletion and permanent purge

**Files:**
- Create: `src/domain/lifecycle/deletion.ts`
- Create: `src/data/repositories/deletion-repository.ts`
- Create: `src/jobs/purge-expired-deletions.ts`
- Test: `tests/unit/domain/deletion.test.ts`
- Test: `tests/integration/jobs/purge-expired-deletions.test.ts`

**Interfaces:**
- Produces: `markDeleted(nodeId, deletedAt, purgeAfter)`.
- Produces: `restoreDeleted(nodeId, now)`.
- Produces: `purgeExpiredDeletions(now): { purgedNodeIds: string[] }`.

- [ ] **Step 1: Write exact boundary tests**

```ts
expect(canRestore({ deletedAt, purgeAfter }, oneMillisecondBefore(purgeAfter))).toBe(true);
expect(canRestore({ deletedAt, purgeAfter }, purgeAfter)).toBe(false);
```

Add an integration test proving purge deletes ciphertext and edges, retains only privacy-safe audit facts, and is idempotent when run twice.

Run: `pnpm exec vitest run tests/unit/domain/deletion.test.ts tests/integration/jobs/purge-expired-deletions.test.ts`

Expected: FAIL because lifecycle logic does not exist.

- [ ] **Step 2: Implement lifecycle rules**

Set `purgeAfter` to exactly 30 days from confirmed deletion. Restoration before the boundary reactivates the encrypted record without changing protected content. Purge at or after the boundary removes protected payloads, related edges, and recovery records transactionally, then emits a non-sensitive purge audit fact.

- [ ] **Step 3: Verify lifecycle and milestone regression**

Run:

```powershell
pnpm exec vitest run tests/unit/domain tests/unit/crypto tests/unit/audit
pnpm exec vitest run tests/contract/data tests/integration/data tests/integration/jobs
pnpm check
```

Expected: all commands pass.

- [ ] **Step 4: Commit lifecycle behavior**

```powershell
git add src/domain/lifecycle src/data/repositories src/jobs tests
git commit -m "feat: add recoverable deletion lifecycle"
```

## Milestone verification

Apply the migration to an isolated preview database, insert protected sentinel fixtures, query the raw tables using the least-privileged role, and run the full data/crypto/audit/lifecycle suite. Record migration checksum, schema constraints, and sentinel-scan output. Do not use production data or production keys.
