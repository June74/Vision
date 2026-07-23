# Vision Phase B AI Budget and Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe category proposals, strict AI spending controls, operational health calculation, and a diagnostic calendar interface without granting model authority or event-write capability.

**Architecture:** A provider-neutral AI port receives a minimum-context request and returns a structured proposal. Deterministic domain code validates privacy, category provenance, schema, freshness, and budget; diagnostic APIs expose only the state needed for the authenticated UI.

**Tech Stack:** OpenAI Responses API, Cloudflare AI Gateway, Zod Structured Outputs, PostgreSQL usage ledger, React, Hono, Vitest, Playwright.

## Global Constraints

- `gpt-5.6-luna` handles routine categorization, extraction, summaries, and alert wording.
- `gpt-5.6-terra` is allowed only for justified complex multi-constraint planning; Phase B category proposals default to Luna.
- The flagship model is excluded from the default route.
- AI receives no credentials, tokens, keys, unrelated records, unrestricted storage access, or direct Google tools.
- Model output is untrusted and cannot authorize, share, delete, lower privacy, or create external effects.
- Explicit category overrides confirmed source association, which overrides inference.
- Visibly mark inferred categories and keep ambiguous/mixed items unresolved.
- Warn at $8.00, disable optional work at $9.00, and block new AI requests at $9.50 with concurrency one.
- Direct calendar display, synchronization, deterministic conflict checks, and template status continue when AI is unavailable.
- For every production file and named function, maintain concise `docs/reference/simple/` and in-depth `docs/reference/technical/` entries at mirrored paths; document meaningful folders with `_folder.md` in both trees.
- Require module/function JSDoc, comment non-obvious model/privacy/budget invariants, and run `pnpm docs:check` before every task commit.

---

### Task 1: Define provider-neutral AI and category proposal contracts

**Files:**
- Create: `src/domain/categorization/proposal.ts`
- Create: `src/integrations/openai/ai-provider.ts`
- Create: `src/integrations/openai/category-schema.ts`
- Test: `tests/unit/domain/category-proposal.test.ts`
- Test: `tests/contract/openai/category-schema.contract.test.ts`

**Interfaces:**
- Produces: `AiProvider.proposeCategory(request): Promise<CategoryProposal>`.
- Produces: `CategoryProposal { domain; confidence; evidenceIds; ambiguous; rationaleCode }`.
- Produces: `applyCategoryProposal(current, proposal): CategoryDecision`.

- [ ] **Step 1: Write authority and ambiguity tests**

```ts
expect(applyCategoryProposal(explicitWork, highConfidencePersonal)).toEqual(explicitWork);
expect(applyCategoryProposal(unresolved, {
  domain: "school", confidence: 0.51, evidenceIds: [], ambiguous: true,
  rationaleCode: "mixed_context",
})).toMatchObject({ domain: "unresolved", state: "unresolved" });
```

Add schema tests rejecting unknown domains, extra action/tool fields, missing evidence IDs, out-of-range confidence, and text that attempts to change privacy or permissions.

Run: `pnpm exec vitest run tests/unit/domain/category-proposal.test.ts tests/contract/openai/category-schema.contract.test.ts`

Expected: FAIL because proposal contracts do not exist.

- [ ] **Step 2: Implement closed proposal and validator**

Use a strict Zod schema with no side-effect fields. A proposal may only set an inferred category when it is non-ambiguous, above the configured evaluated threshold, and does not override explicit/confirmed state. Preserve evidence IDs and model metadata for audit without retaining raw reasoning.

- [ ] **Step 3: Verify deterministic authority**

Run: `pnpm exec vitest run tests/unit/domain/category-proposal.test.ts tests/contract/openai/category-schema.contract.test.ts`

Expected: all proposal tests pass.

- [ ] **Step 4: Commit AI contracts**

```powershell
git add src/domain/categorization src/integrations/openai tests/unit/domain tests/contract/openai
git commit -m "feat: define safe AI category proposals"
```

### Task 2: Implement minimum-context OpenAI adapter

**Files:**
- Create: `src/integrations/openai/context-builder.ts`
- Create: `src/integrations/openai/openai-provider.ts`
- Create: `src/integrations/openai/model-router.ts`
- Modify: `src/server/env.ts`
- Test: `tests/unit/integrations/context-builder.test.ts`
- Test: `tests/contract/openai/responses-api.contract.test.ts`

**Interfaces:**
- Produces: `buildCategoryContext(event, permittedEvidence): CategoryContextPacket`.
- Produces: `OpenAiProvider` implementing `AiProvider`.
- Produces: `routeModel(task): "gpt-5.6-luna" | "gpt-5.6-terra"`.

- [ ] **Step 1: Write context-minimization and injection tests**

Use a fixture containing refresh token, attendee email, unrelated note, location, description injection, and allowed event title/time. Assert the outgoing category packet contains only opaque event ID, permitted title tokens or decrypted title when required, schedule context, source association, and policy version. Assert it contains no token, unrelated note, attendee, meeting link, raw HTML, or tool definition.

Run: `pnpm exec vitest run tests/unit/integrations/context-builder.test.ts tests/contract/openai/responses-api.contract.test.ts`

Expected: FAIL because adapter modules do not exist.

- [ ] **Step 2: Implement structured Responses API requests**

Inject `fetch`, AI Gateway base URL, provider key, and model configuration. Send a strict structured-output schema, bounded output tokens, no tools, and the minimum context packet. Parse through Zod; return a typed refusal/invalid-schema result without side effects. Store token/cost metadata, model ID, policy version, request ID, and evidence IDs but not raw chain-of-thought.

- [ ] **Step 3: Implement routing policy**

Route Phase B category and wording tasks to Luna. Permit Terra only for a typed future `complex_planning` class after deterministic complexity criteria and budget eligibility; tests must prove ordinary categorization never routes to Terra or flagship.

- [ ] **Step 4: Verify adapter contracts**

Run: `pnpm exec vitest run tests/unit/integrations/context-builder.test.ts tests/contract/openai/responses-api.contract.test.ts`

Expected: all privacy, schema, refusal, and routing cases pass.

- [ ] **Step 5: Commit the AI adapter**

```powershell
git add src/integrations/openai src/server/env.ts tests/unit/integrations tests/contract/openai
git commit -m "feat: add minimum-context OpenAI adapter"
```

### Task 3: Enforce the AI spending contract

**Files:**
- Create: `src/domain/budget/ai-budget.ts`
- Create: `src/data/repositories/ai-usage-repository.ts`
- Create: `src/integrations/openai/budgeted-ai-provider.ts`
- Test: `tests/unit/domain/ai-budget.test.ts`
- Test: `tests/integration/openai/budgeted-provider.test.ts`

**Interfaces:**
- Produces: `evaluateAiBudget(monthlyCents, requestClass): AiBudgetDecision`.
- Produces: `AiUsageRepository.reserve`, `settle`, and `release`.
- Produces: `BudgetedAiProvider` enforcing one in-flight request.

- [ ] **Step 1: Write exact threshold tests**

```ts
expect(evaluateAiBudget(799, "routine").mode).toBe("normal");
expect(evaluateAiBudget(800, "routine").mode).toBe("luna_only");
expect(evaluateAiBudget(900, "optional").allowed).toBe(false);
expect(evaluateAiBudget(950, "routine").allowed).toBe(false);
```

Add concurrency, stale reservation, provider-cost-overestimate, gateway rejection, month rollover in America/Chicago, and non-AI fallback tests.

Run: `pnpm exec vitest run tests/unit/domain/ai-budget.test.ts tests/integration/openai/budgeted-provider.test.ts`

Expected: FAIL because budget modules do not exist.

- [ ] **Step 2: Implement reservation and settlement**

Inside a database transaction, acquire the single-user concurrency lease, estimate worst-case request cents, reject if the reservation would cross $9.50, and persist the reservation. Settle from actual provider usage; release on pre-dispatch failure; expire abandoned reservations safely. Configure matching Cloudflare AI Gateway spend limits as a second barrier.

- [ ] **Step 3: Verify core functions survive budget exhaustion**

Run a Worker contract test at $9.50 and assert event listing, sync status, deterministic category correction, and template diagnostics remain `200`, while AI proposal returns `AI_BUDGET_EXHAUSTED` with no provider call.

- [ ] **Step 4: Commit budget enforcement**

```powershell
git add src/domain/budget src/data/repositories src/integrations/openai tests/unit/domain tests/integration/openai
git commit -m "feat: enforce private-pilot AI budget"
```

### Task 4: Add health calculation and diagnostic APIs

**Files:**
- Create: `src/domain/operations/health.ts`
- Create: `src/server/api/diagnostic-routes.ts`
- Create: `src/data/repositories/diagnostic-repository.ts`
- Modify: `src/worker.ts`
- Test: `tests/unit/domain/health.test.ts`
- Test: `tests/worker/diagnostics.test.ts`

**Interfaces:**
- Produces: `HealthState = "Healthy" | "Delayed" | "Action required" | "Disconnected"`.
- Produces: `GET /api/diagnostics/status`, `GET /api/calendar/events`, and `PATCH /api/calendar/events/:id/category`.

- [ ] **Step 1: Write health precedence and API privacy tests**

Test healthy, delayed sync, oldest-job delay, failed jobs, expired channel, revoked OAuth, database failure, AI budget warning, and R2 warning. Define precedence: disconnected authorization, then action-required failure, then delayed, then healthy. Assert APIs require a session and never return encrypted token/ciphertext/key fields.

Run: `pnpm exec vitest run tests/unit/domain/health.test.ts tests/worker/diagnostics.test.ts`

Expected: FAIL because health and routes do not exist.

- [ ] **Step 2: Implement diagnostics and category correction**

Calculate health from timestamped facts with explicit freshness thresholds. Return last successful sync, sync delay, queue retry count, failed-job count, channel expiry, authorization state, AI spend tier, database/R2 usage warning, and safe error code. Event listing decrypts protected display fields only after authorization. Category correction writes an explicit decision and invalidates weaker inference.

- [ ] **Step 3: Verify diagnostics**

Run: `pnpm exec vitest run tests/unit/domain/health.test.ts tests/worker/diagnostics.test.ts`

Expected: all states and response redaction tests pass.

- [ ] **Step 4: Commit diagnostics API**

```powershell
git add src/domain/operations src/server/api src/data/repositories src/worker.ts tests/unit/domain tests/worker
git commit -m "feat: expose safe foundation diagnostics"
```

### Task 5: Build synchronized calendar and status UI

**Files:**
- Create: `src/client/calendar/EventList.tsx`
- Create: `src/client/calendar/CategoryControl.tsx`
- Create: `src/client/status/FoundationStatus.tsx`
- Create: `src/client/status/CostStatus.tsx`
- Create: `src/client/status/api.ts`
- Modify: `src/client/App.tsx`
- Test: `tests/e2e/foundation-diagnostics.spec.ts`

**Interfaces:**
- Consumes: authenticated diagnostic routes from Task 4.
- Produces: read-only synchronized event list, visible inferred/unresolved categories, manual correction, operational state, sync age, and budget tier.

- [ ] **Step 1: Write browser acceptance flows**

Test that the browser:

1. Shows synced event title/time but no edit/delete controls.
2. Labels inferred category as `Suggested`.
3. Labels ambiguity as `Needs category`.
4. Allows an explicit category correction and preserves it after reload.
5. Shows `Delayed`, `Action required`, and `Disconnected` with actionable copy.
6. Shows AI warning/stopped state while event viewing still works.

Run: `pnpm test:e2e -- foundation-diagnostics.spec.ts`

Expected: FAIL because diagnostic components do not exist.

- [ ] **Step 2: Implement the read-only diagnostic experience**

Render semantic lists/tables, timezone-aware times, provenance badges, visible inference state, and server-provided health facts. Do not render connected-calendar mutation buttons. Category changes must state that they affect Vision only, not Google Calendar.

- [ ] **Step 3: Verify the actual UI**

Run: `pnpm test:e2e -- foundation-diagnostics.spec.ts && pnpm check`

Expected: all six browser flows pass.

- [ ] **Step 4: Commit the diagnostic UI**

```powershell
git add src/client tests/e2e/foundation-diagnostics.spec.ts
git commit -m "feat: add foundation diagnostic calendar"
```

## Milestone verification

Run the complete AI contract, budget, diagnostics, and browser suites with injected provider responses for valid output, refusal, invalid schema, timeout, prompt injection, $8.00, $9.00, and $9.50 states. With explicit approval and a configured preview key, run one harmless category request through AI Gateway, record only model/usage/status metadata, and prove the outgoing context excludes protected unrelated sentinels.
