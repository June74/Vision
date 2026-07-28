# Preview Database Role Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the temporary disposable-target connection authenticates as
`vision_app` through the exact Cloudflare Worker and Neon pool boundary before
the fenced restore can claim its one-shot marker.

**Architecture:** The existing preview one-minute scheduled path temporarily
routes to a new isolated role-probe job. That job validates one preview-only
secret, calls a read-only max-one Neon pool adapter, and emits one fixed-schema
allowlisted record. A probe-only safe-tail observer starts before deployment;
normal ref `40872a5` is restored immediately after one terminal record.

**Tech Stack:** Strict TypeScript, Hono/Cloudflare Workers scheduled handler,
Neon PostgreSQL serverless pool, Zod, Vitest, GitHub Actions, Wrangler.

## Global Constraints

- Preview only; no public HTTP route.
- Accept only `VISION_ENV=preview` and `PREVIEW_RESTORE_DATABASE_URL`.
- Execute only `select current_user = 'vision_app' as role_ok`.
- Never import or call restore, clear, backup, R2, or encryption-key code.
- Never read database tables, attestation, target identity, rows, or provider
  metadata.
- Never return raw role names, SQL, connection information, error text,
  provider identifiers, secret values, or authenticated URLs.
- Every pool, client, query, release, and close failure maps to fixed evidence.
- `BACKUP_ENCRYPTION_KEY` remains unchanged at key version 1.
- Never access `backups/v1/` or `restore-attempts/v1/`.
- Live use requires listener-before-deployment and one unambiguous success.
- The previously reviewed fenced restore remains exact commit `0f08fc1`.
- The immutable normal preview runtime remains exact ref `40872a5`.

---

### Task 1: Implement and review the isolated read-only role probe

**Files:**
- Create: `src/data/backup/temporary-preview-role-probe-adapter.ts`
- Create: `src/jobs/temporary-preview-role-probe.ts`
- Modify: `src/server/env.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `.github/workflows/preview.yml`
- Create: `tests/integration/backup/temporary-preview-role-probe-adapter.test.ts`
- Create: `tests/integration/jobs/temporary-preview-role-probe.test.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify: `tests/unit/scripts/print-safe-tail.test.ts`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `docs/operations/restore-drill.md`
- Create or modify matching simple and technical reference pages under
  `docs/reference/`

**Interfaces:**
- Produces:

```ts
export interface TemporaryPreviewRoleProbeClientPort {
  query<Row extends Record<string, unknown>>(
    sql: string,
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
}

export interface TemporaryPreviewRoleProbePoolPort {
  connect(): Promise<TemporaryPreviewRoleProbeClientPort>;
  end(): Promise<void>;
}

export interface TemporaryPreviewRoleProbeAdapter {
  probeRole(): Promise<boolean>;
}

export function createPostgresTemporaryPreviewRoleProbeAdapter(
  pool: TemporaryPreviewRoleProbePoolPort,
): TemporaryPreviewRoleProbeAdapter;

export function createTemporaryPreviewRoleProbeAdapter(
  connectionString: string,
): TemporaryPreviewRoleProbeAdapter;
```

- Produces:

```ts
export type TemporaryPreviewRoleProbeFailureCategory =
  | "role_probe_configuration_invalid"
  | "role_probe_query_failed"
  | "role_probe_role_mismatch";

export interface TemporaryPreviewRoleProbeEvidence {
  readonly evidenceType: "vision.preview-role-probe/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category:
    | "none"
    | TemporaryPreviewRoleProbeFailureCategory;
  readonly roleMatches: boolean;
}

export interface TemporaryPreviewRoleProbeDependencies {
  readonly probeRole: (connectionString: string) => Promise<boolean>;
}

export function runTemporaryPreviewRoleProbe(
  environment: unknown,
  dependencies: TemporaryPreviewRoleProbeDependencies,
): Promise<TemporaryPreviewRoleProbeEvidence>;
```

- The scheduler emits exactly:

```ts
{
  action: "backup.restore-role-probe",
  evidence: TemporaryPreviewRoleProbeEvidence,
}
```

- `TemporaryRoleProbeEnvSchema` is strict and contains only:

```ts
{
  VISION_ENV: z.literal("preview"),
  PREVIEW_RESTORE_DATABASE_URL: RuntimeEnvSchema.shape.DATABASE_URL,
}
```

- The safe-tail classifier adds `TemporaryPreviewRoleProbeEvidence` to
  `SafeTailResult`, reconstructs exact keys
  `["category", "evidenceType", "outcome", "roleMatches"]`, and recognizes
  only action `backup.restore-role-probe` on the one-minute cron.
- `scripts/print-safe-tail.ts` accepts `--role-probe-only`; that mode rejects
  recovery and restore evidence.
- The probe commit's preview workflow runs:

```text
pnpm exec tsx scripts/print-safe-tail.ts --role-probe-only
```

- The confirmed live path must remain:

```text
Cloudflare cron
  -> src/worker.ts:scheduled
  -> src/jobs/scheduled.ts:scheduled
  -> runScheduledJob("* * * * *")
  -> runTemporaryPreviewRoleProbe
  -> createTemporaryPreviewRoleProbeAdapter
  -> Pool({ connectionString, max: 1 })
  -> select current_user = 'vision_app' as role_ok
  -> backup.restore-role-probe safe evidence
```

- [ ] **Step 1: Write failing adapter tests**

Cover:

```ts
it("uses one retained client and one exact read-only query");
it("returns true only for exactly one literal true row");
it.each([
  "false",
  "zero rows",
  "multiple rows",
  "missing role_ok",
  "nonboolean role_ok",
])("fails closed for %s");
it("releases and closes when query fails");
it("closes the pool when connect fails");
it("does not return private values or raw errors");
```

Assert the only query is exactly:

```sql
select current_user = 'vision_app' as role_ok
```

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\integration\backup\temporary-preview-role-probe-adapter.test.ts
```

Expected: RED because the adapter module does not exist.

- [ ] **Step 2: Implement the minimal adapter**

Follow the retained-client and injected-pool pattern from
`temporary-preview-clear-adapter.ts`, without transactions or any other SQL.
Require exactly one row and a literal boolean. Throw only:

```text
Temporary preview role probe failed.
```

Release the client and close the pool in `finally`. If release or close fails,
the operation fails closed with the same fixed message.

- [ ] **Step 3: Verify adapter GREEN**

Run the exact command from Step 1.

Expected: all adapter tests pass.

- [ ] **Step 4: Write failing job, environment, scheduler, evidence, and workflow tests**

Cover:

- invalid environment never calls the adapter and returns fixed configuration
  failure;
- adapter `true` returns the exact success object;
- adapter `false` returns exact role-mismatch failure;
- thrown adapter failure returns exact query failure;
- hostile errors and secret sentinels never appear in evidence or logs;
- only the one-minute cron calls the probe;
- maintenance and daily backup routing remain unchanged;
- scheduler constructs no restore, clear, backup, R2, or key capability;
- classifier rejects extra keys, missing keys, wrong action, wrong cron,
  accessors, symbols, prototypes, and raw provider text;
- `--role-probe-only` emits only the role-probe evidence and otherwise returns
  the fixed no-event object;
- preview observer remains in `vision-preview-observer`;
- deployment remains in `vision-preview-mutation`; and
- the probe observer retains the 16-minute tail and 18-minute job limits.

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests\integration\jobs\temporary-preview-role-probe.test.ts tests\integration\jobs\daily-backup.test.ts tests\unit\scripts\safe-tail-classifier.test.ts tests\unit\scripts\print-safe-tail.test.ts tests\unit\ci\workflows.test.ts
```

Expected: RED because the job, evidence, routing, and mode do not exist.

- [ ] **Step 5: Implement the minimal job and wiring**

Add the strict environment schema, job, scheduler dependency, exact logger,
classifier branch, printer mode, and workflow argument. Remove the temporary
restore imports and production dependency construction from this probe commit;
the exact restore candidate remains preserved at `0f08fc1`.

Do not add a route, generic SQL helper, retry loop, R2 fence, target-ID binding,
or reusable provider diagnostic framework.

- [ ] **Step 6: Verify focused GREEN**

Run both focused commands from Steps 1 and 4.

Expected: every focused test passes.

- [ ] **Step 7: Run the complete local gate**

Run:

```powershell
pnpm.cmd check
```

Expected: TypeScript, all unit/integration, contract, Worker, documentation,
build, and release-security checks exit zero. Record known sandbox-only
Wrangler warnings separately from successful exits.

- [ ] **Step 8: Independently review**

Require both verdicts:

```text
Specification compliance: PASS
Code quality and safety: PASS
Critical findings: 0
Important findings: 0
```

The reviewer must explicitly confirm:

- the production path executes only the exact SELECT;
- no restore, clear, R2, backup-key, target-ID, or HTTP capability is reachable;
- every resource closes on every path;
- evidence is fixed and value-free; and
- the listener remains separate from deployment.

- [ ] **Step 9: Commit and push the exact reviewed probe**

Commit only after review is clean. Preserve its full public SHA for Task 2.

---

### Task 2: Run the probe, return to normal, and resume the approved restore

**Files:**
- Modify after confirmed actions: `docs/operations/credential-change-log.md`
- Modify after confirmed actions: `docs/operations/restore-drill.md`
- Modify after confirmed actions: `docs/operations/phase-b-evidence.md`
- Modify on any setback: `docs/operations/setbacks/INDEX.md` and the matching
  exact incident

**Interfaces:**
- Consumes: reviewed Task 1 SHA, signed-in Cloudflare and Neon controls,
  `PREVIEW_RESTORE_DATABASE_URL`, immutable normal ref `40872a5`, fenced restore
  candidate `0f08fc1`, and unchanged backup key version 1.
- Produces: one accepted read-only role success, normal runtime restored, then
  the already-approved listener-first fenced restore sequence.

- [ ] **Step 1: Reconfirm exact immutable state**

Require:

```text
clean worktree
local head equals remote head
reviewed probe SHA resolves
normal ref 40872a5 resolves
restore candidate 0f08fc1 resolves
focused tests pass
independent review accepted
```

- [ ] **Step 2: Create only the database-URL secret**

Through signed-in provider controls, create only:

```text
PREVIEW_RESTORE_DATABASE_URL
```

Verify only name and type `Secret`. Never print, inspect, persist, or return its
value.

- [ ] **Step 3: Start and prove the probe-only observer**

Dispatch the safe-tail workflow at the exact probe SHA. Continue only when
`Print only allowlisted scheduled evidence` is actively `in_progress`.

- [ ] **Step 4: Deploy the exact probe SHA**

While the observer remains active, dispatch preview deployment for the exact
probe SHA. Prove observer/deployment overlap and exact commit attribution.

- [ ] **Step 5: Accept one terminal record**

Accept only:

```text
evidenceType=vision.preview-role-probe/v1
outcome=succeeded
category=none
roleMatches=true
```

Any failure, no result, malformed result, duplicate ambiguity, or wrong
attribution fails closed.

- [ ] **Step 6: Restore normal runtime immediately**

Deploy exact normal ref `40872a5`. Require normal health, maintenance and daily
backup crons present, and the one-minute cron absent.

- [ ] **Step 7: Branch on the probe result**

If the probe was not accepted, permanently delete
`PREVIEW_RESTORE_DATABASE_URL`, verify absence, and stop.

If accepted, keep the secret only long enough to recreate
`PREVIEW_RESTORE_TARGET_ID` and resume active Task 3 from
`docs/superpowers/plans/2026-07-27-listener-before-activation-restore-retry.md`
using exact restore candidate `0f08fc1`. Do not request approval again for
those already-approved steps.

- [ ] **Step 8: Record only safe evidence**

Record public SHAs, secret names and presence/type, fixed booleans, safe counts,
schema version, key version, and terminal categories. Never record any private
value or identifier.
