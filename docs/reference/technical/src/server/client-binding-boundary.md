# Client binding boundary

The client scanner derives forbidden temporary values from the canonical
domain selector tuple, including `sync_suppression`, while preserving the
strict separation from the six fault scenarios.

`src/server/client-binding-boundary.ts` is the authoritative binding-name classification consumed by the Phase B release scanner.

`RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES` and `CLIENT_SAFE_RUNTIME_BINDING_NAMES` form an exact partition of `RuntimeEnvSchema.shape`, enforced by a contract test. `CLIENT_FORBIDDEN_BINDING_NAMES` extends the runtime denylist with operator restore and Cloudflare deployment credentials that are intentionally outside the Worker runtime schema.

The scanner imports this inventory directly. A new runtime binding cannot silently remain unclassified, and every client-forbidden entry is exercised against a built-asset fixture.

`PREVIEW_RESTORE_DATABASE_URL` and `PREVIEW_RESTORE_TARGET_ID` are optional
Worker runtime fields, so both are classified in
`RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES`. Moving them from the outer-only
portion preserves the effective client denylist while keeping the runtime
partition exact. Worker-bundle scanning checks protected values but deliberately
does not apply this name inventory, because server code must be able to
reference those binding names.

`PREVIEW_ACCEPTANCE_SCENARIO`,
`PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT`, and
`PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED` are runtime
client-forbidden. `CLIENT_FORBIDDEN_RUNTIME_VALUES` imports the complete frozen
eleven-selector candidate vocabulary, so the dedicated foundation, AI, and
synchronization-suppression selectors cannot enter a built browser asset
either.
