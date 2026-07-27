# Temporary Preview Worker Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the existing encrypted preview backup into the attested
disposable Neon branch without rotating or exporting the backup key, prove the
committed result, and remove every temporary runtime surface afterward.

**Architecture:** A temporary preview-only cron runs a focused restore job
inside the existing Worker, where the current R2 binding and unchanged backup
key are already available. The job selects one verified backup, reuses the
transactional restore adapter, performs an independent target read-back, and
emits only a closed safe evidence object. A final cleanup commit removes the
cron, job, temporary configuration, and secrets before the disposable branch
is deleted.

**Tech Stack:** TypeScript, Hono/Cloudflare Workers, Cloudflare R2 and scheduled
Workers, Neon PostgreSQL, Drizzle ORM, Zod, Vitest/PGlite, GitHub Actions,
Wrangler, pnpm.

## Global Constraints

- `BACKUP_ENCRYPTION_KEY` and `BACKUP_KEY_VERSION` remain unchanged.
- The normal preview `DATABASE_URL` is never passed to the restore adapter.
- The restore target must be preview-only, disposable, independently
  identity-attested, schema version 9, and bound to the reviewed migration
  checksum and attestation revision.
- The target must be empty; replacement of a non-empty target is forbidden.
- Promotion remains one serializable, lock-protected transaction.
- No branch identifier, object key, database URL, key, token, account
  identifier, OAuth value, protected row, or provider-controlled URL may enter
  logs, documentation, CI output, or chat.
- Any failed or uncertain restore retains the disposable branch and blocks
  cleanup.
- Branch deletion occurs only after successful read-back verification, normal
  Worker redeployment, temporary-secret removal, and live health verification.
- Phase B keeps every event-level Google create, update, patch, move, cancel,
  and delete surface disabled.
- Every production source file and named function keeps mirrored simple and
  technical documentation plus concise JSDoc.

---

### Task 1: Build the preview-only restore engine and read-back verifier

**Files:**
- Create: `src/jobs/temporary-preview-restore.ts`
- Create: `tests/integration/jobs/temporary-preview-restore.test.ts`
- Modify: `src/server/env.ts`
- Modify: `tests/unit/server/env.test.ts`
- Modify: `src/jobs/purge-expired-backups.ts`
- Modify: `tests/integration/jobs/backup-retention.test.ts`
- Create: `docs/reference/simple/src/jobs/temporary-preview-restore.md`
- Create: `docs/reference/technical/src/jobs/temporary-preview-restore.md`
- Modify: `docs/reference/simple/src/jobs/_folder.md`
- Modify: `docs/reference/technical/src/jobs/_folder.md`

**Interfaces:**
- Produces:

```ts
export const TEMPORARY_PREVIEW_RESTORE_CRON = "* * * * *" as const;

export type TemporaryRestoreFailureCategory =
  | "restore_configuration_invalid"
  | "restore_candidate_invalid"
  | "restore_object_verification_failed"
  | "restore_backup_validation_failed"
  | "restore_target_attestation_failed"
  | "restore_target_not_empty"
  | "restore_promotion_failed"
  | "restore_readback_verification_failed"
  | "restore_unknown_failure";

export interface TemporaryRestoreEvidence {
  readonly evidenceType: "vision.preview-restore/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category: "none" | TemporaryRestoreFailureCategory;
  readonly format?: "vision-backup/v1";
  readonly schemaVersion?: 9;
  readonly keyVersion?: number;
  readonly authoritativeTableCount?: 29;
  readonly rowCounts?: BackupRowCounts;
  readonly checksumMatches?: boolean;
  readonly referencesValid?: boolean;
  readonly targetWasEmpty?: boolean;
  readonly eventListReadable?: boolean;
  readonly eventCount?: number;
  readonly replacedExisting?: false;
}

export interface TemporaryPreviewRestoreDependencies {
  readonly store: BackupObjectStore;
  readonly backupKey: BackupEncryptionKey;
  readonly createTarget: (
    databaseUrl: string,
    targetId: string,
  ) => Promise<ManagedBackupRestoreTarget>;
  readonly readTargetSnapshot: (
    databaseUrl: string,
  ) => Promise<BackupSnapshotV1>;
  readonly countReadableEvents: (
    databaseUrl: string,
  ) => Promise<number>;
}

export async function runTemporaryPreviewRestore(
  environment: unknown,
  dependencies: TemporaryPreviewRestoreDependencies,
): Promise<TemporaryRestoreEvidence>;
```

- Produces:

```ts
export const TemporaryRestoreEnvSchema = z.object({
  VISION_ENV: z.literal("preview"),
  PREVIEW_RESTORE_DATABASE_URL: RuntimeEnvSchema.shape.DATABASE_URL,
  PREVIEW_RESTORE_TARGET_ID: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/u),
}).strict();
```

- Produces:

```ts
export function validatedBackupObjectDate(
  object: BackupObjectHead,
): number | undefined;
```

- Consumes existing `readVerifiedStoredBackup`, `importBackup`,
  `ManagedBackupRestoreTarget`, `encodeCanonicalBackupArchive`,
  `countSnapshotRows`, `sha256Base64Url`, and
  `validateBackupReferences`. Concrete Neon adapters remain outside this
  injected engine and are assembled by Task 2's production dependency
  factory.

- [ ] **Step 1: Write the failing environment tests**

Add tests that accept exactly preview plus a `vision_app` target URL and opaque
target ID, and reject local/production, missing pairs, a privileged role,
control characters, and unexpected fields without echoing supplied values:

```ts
expect(
  TemporaryRestoreEnvSchema.parse({
    VISION_ENV: "preview",
    PREVIEW_RESTORE_DATABASE_URL:
      "postgresql://vision_app:synthetic@preview.example.test/vision",
    PREVIEW_RESTORE_TARGET_ID: "disposable_preview_1",
  }),
).toMatchObject({ VISION_ENV: "preview" });

for (const VISION_ENV of ["local", "production"]) {
  expect(() =>
    TemporaryRestoreEnvSchema.parse({
      VISION_ENV,
      PREVIEW_RESTORE_DATABASE_URL:
        "postgresql://vision_app:synthetic@preview.example.test/vision",
      PREVIEW_RESTORE_TARGET_ID: "disposable_preview_1",
    }),
  ).toThrow();
}
```

- [ ] **Step 2: Run the environment test and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/unit/server/env.test.ts
```

Expected: failure because `TemporaryRestoreEnvSchema` is not exported.

- [ ] **Step 3: Implement the strict temporary environment schema**

Add optional fields to `RuntimeEnvSchema` and `Env` only so the normal Worker
can start without them. Parse them through a separate strict schema only when
the temporary cron runs. Error messages remain constant and value-free.

- [ ] **Step 4: Export and test the existing closed backup-object validator**

Rename the private retention helper to
`validatedBackupObjectDate`, export it, and retain its exact path/date/metadata
agreement checks. Add assertions that malformed names, extra metadata,
date/path disagreement, and missing native checksums return `undefined`.

- [ ] **Step 5: Write failing engine tests**

Build fixtures with `MemoryBackupObjectStore`, the existing encrypted-backup
helpers, and injected targets. Cover:

```ts
it.each([
  "empty list",
  "malformed candidate",
  "ambiguous newest date",
  "wrong key version",
])("fails closed for %s", async () => {
  const result = await runTemporaryPreviewRestore(
    fixture.environment,
    fixture.dependencies,
  );
  expect(result.outcome).toBe("failed");
  expect(result.category).toMatch(/^restore_/u);
  expect(JSON.stringify(result)).not.toContain(fixture.privateSentinel);
});
```

Add separate cases for tampered metadata/body/envelope/manifest/checksum,
attestation mismatch, non-empty target, transaction rollback, exact 29-table
success, read-back row-count mismatch, reference failure, archive-checksum
mismatch, unreadable event listing, and a repeated invocation that cannot
replace data.

- [ ] **Step 6: Run the engine test and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/integration/jobs/temporary-preview-restore.test.ts
```

Expected: failure because the restore job module does not exist.

- [ ] **Step 7: Implement candidate selection and restore**

List the fixed prefix across every R2 page, require every listed object to pass
`validatedBackupObjectDate`, choose the greatest UTC date, require exactly one
candidate for that date, and require its metadata key version to equal the
unchanged runtime key version. Call `readVerifiedStoredBackup` before
`createTarget`. Call `importBackup` with:

```ts
{
  replaceDisposableTarget: false,
  assertedEnvironment: "preview",
}
```

Pass `managedTarget.target` to `importBackup` and always release its pool:

```ts
const managedTarget = await dependencies.createTarget(
  parsed.PREVIEW_RESTORE_DATABASE_URL,
  parsed.PREVIEW_RESTORE_TARGET_ID,
);
try {
  report = await importBackup(
    verifiedBackup.encrypted,
    dependencies.backupKey,
    managedTarget.target,
    {
      replaceDisposableTarget: false,
      assertedEnvironment: "preview",
    },
  );
} finally {
  await managedTarget.close();
}
```

Never enable replacement or emit the selected object key.

- [ ] **Step 8: Implement independent read-back verification**

After commit, read the target snapshot through
`createNeonBackupSnapshotSource`, require:

```ts
const counts = countSnapshotRows(snapshot);
validateBackupReferences(snapshot.tables);
const archiveSha256 = await sha256Base64Url(
  encodeCanonicalBackupArchive(snapshot),
);
```

Every count must equal the restore report; `archiveSha256` must equal
`report.plaintextSha256`; the event-list dependency must return a nonnegative
safe integer; and `report.replacedExisting` must be `false`. Return only the
closed `TemporaryRestoreEvidence`.

- [ ] **Step 9: Run focused tests and documentation coverage**

Run:

```powershell
pnpm.cmd test:unit tests/unit/server/env.test.ts tests/integration/jobs/backup-retention.test.ts tests/integration/jobs/temporary-preview-restore.test.ts
pnpm.cmd typecheck
pnpm.cmd docs:check
```

Expected: all focused assertions pass, both TypeScript projects exit zero, and
documentation coverage exits zero.

- [ ] **Step 10: Commit the restore engine**

```powershell
git add -- src/jobs/temporary-preview-restore.ts src/server/env.ts src/jobs/purge-expired-backups.ts tests/integration/jobs/temporary-preview-restore.test.ts tests/integration/jobs/backup-retention.test.ts tests/unit/server/env.test.ts docs/reference/simple/src/jobs docs/reference/technical/src/jobs
git commit -m "feat: add preview-only restore engine"
```

### Task 2: Wire the temporary cron and privacy-safe evidence

**Files:**
- Modify: `src/jobs/scheduled.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify: `src/server/env.ts`
- Modify: `docs/reference/simple/src/jobs/scheduled.md`
- Modify: `docs/reference/technical/src/jobs/scheduled.md`

**Interfaces:**
- Extends `ScheduledJobDependencies` with:

```ts
readonly temporaryRestore: (now: Date) => Promise<void>;
```

- Produces:

```ts
export function classifyTemporaryRestoreEvidence(
  candidate: unknown,
): TemporaryRestoreEvidence | null;
```

- The Worker log record is exactly:

```ts
{
  action: "backup.restore",
  evidence: TemporaryRestoreEvidence,
}
```

- [ ] **Step 1: Write the failing scheduler routing tests**

Assert:

```ts
await runScheduledJob(TEMPORARY_PREVIEW_RESTORE_CRON, NOW, dependencies);
expect(dependencies.temporaryRestore).toHaveBeenCalledOnce();
expect(dependencies.maintenance).not.toHaveBeenCalled();
expect(dependencies.recovery).not.toHaveBeenCalled();
```

Keep the existing assertions for `*/15 * * * *`, `5 6 * * *`, and unsupported
crons.

- [ ] **Step 2: Run scheduler tests and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/integration/jobs/daily-backup.test.ts
```

Expected: compile or assertion failure because the temporary dependency is not
wired.

- [ ] **Step 3: Add the scheduled production dependency**

Build the production restore dependency only inside the temporary branch:

```ts
temporaryRestore: async () => {
  const evidence = await runTemporaryPreviewRestore(
    {
      VISION_ENV: environment.VISION_ENV,
      PREVIEW_RESTORE_DATABASE_URL:
        environment.PREVIEW_RESTORE_DATABASE_URL,
      PREVIEW_RESTORE_TARGET_ID: environment.PREVIEW_RESTORE_TARGET_ID,
    },
    await createProductionTemporaryRestoreDependencies(environment),
  );
  console.info({ action: "backup.restore", evidence });
  if (evidence.outcome !== "succeeded") {
    throw new Error("Temporary preview restore failed.");
  }
},
```

The dependency factory uses only `BACKUP_BUCKET`, the unchanged backup key,
the two temporary target fields, the target `vision_app` connection, and the
existing wrapped-key root needed for a read-only restored event listing. Its
`countReadableEvents` implementation must exercise the same owner-scoped,
decrypting repository path as the live diagnostic endpoint:

```ts
countReadableEvents: async (targetDatabaseUrl) => {
  const targetDatabase = createDb(targetDatabaseUrl);
  const ownerId = `usr_${await sha256Base64Url(auth.GOOGLE_ALLOWED_SUB)}`;
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(targetDatabase),
    1,
  );
  const repository = createDiagnosticRepository(
    targetDatabase,
    keyProvider,
    createAiEventRepositoryAccess(ownerId),
    {
      databaseUsageWarning: false,
      r2UsageWarning: false,
    },
  );
  return (await repository.listEvents()).length;
},
```

The returned event rows are discarded immediately; only the nonnegative count
enters the closed evidence object.

- [ ] **Step 4: Write failing safe-tail tests**

Create one exact successful evidence record and one failure per allowlisted
category. Assert the classifier returns only the evidence object and rejects:

- an extra property;
- a free-form error;
- URL-shaped, identifier-shaped, or object-key-shaped strings;
- incomplete or extra row-count keys;
- negative, fractional, or unsafe counts;
- success with any false verification boolean;
- success with `replacedExisting !== false`;
- failure with success-only fields;
- unrelated maintenance and HTTP events.

- [ ] **Step 5: Run safe-tail tests and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/unit/scripts/safe-tail-classifier.test.ts
```

Expected: failure because the temporary restore evidence shape is unsupported.

- [ ] **Step 6: Implement closed evidence parsing**

Parse Wrangler JSON, locate only a log entry whose first message is the exact
two-key restore record, snapshot own enumerable data properties, require the
exact allowed keys for its outcome, and reconstruct a new null-prototype-free
plain result. Never stringify or return the whole tail event.

`print-safe-tail.ts` emits the first accepted restore result. If no accepted
recovery or restore result appears, it retains the current fixed
`no_scheduled_event` output.

- [ ] **Step 7: Run focused scheduler, classifier, and Worker checks**

Run:

```powershell
pnpm.cmd test:unit tests/integration/jobs/daily-backup.test.ts tests/unit/scripts/safe-tail-classifier.test.ts
pnpm.cmd test:worker
pnpm.cmd typecheck
pnpm.cmd docs:check
```

Expected: scheduler/classifier tests pass, all Worker tests pass, type checks
pass, and documentation coverage passes.

- [ ] **Step 8: Commit scheduled restore evidence**

```powershell
git add -- src/jobs/scheduled.ts src/server/env.ts scripts/safe-tail-classifier.ts scripts/print-safe-tail.ts tests/integration/jobs/daily-backup.test.ts tests/unit/scripts/safe-tail-classifier.test.ts docs/reference/simple/src/jobs/scheduled.md docs/reference/technical/src/jobs/scheduled.md
git commit -m "feat: add safe scheduled restore evidence"
```

### Task 3: Produce and review the temporary deployable candidate

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `tests/unit/server/wrangler-routing.test.ts`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `tests/security/secret-bundle.test.ts`
- Modify: `docs/operations/secrets.md`

**Interfaces:**
- Temporary preview cron list:

```json
["*/15 * * * *", "5 6 * * *", "* * * * *"]
```

- Root/local and production cron lists remain:

```json
["*/15 * * * *", "5 6 * * *"]
```

- The guarded workflow continues to expose only mutually exclusive deploy,
  safe-tail, and budget-verification paths.

- [ ] **Step 1: Write failing preview-config tests**

Update the Wrangler routing and generated-config validator tests so only the
preview environment accepts the third exact cron. Assert production rejects
it and preview rejects missing/extra/renamed temporary crons.

- [ ] **Step 2: Run preview-config tests and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts
```

Expected: failure because preview still has only the two normal schedules.

- [ ] **Step 3: Add preview-only temporary configuration**

Set an explicit `env.preview.triggers.crons` list with the three exact entries
and retain the root and `env.production` two-cron lists. Do not place either
temporary target secret in `wrangler.jsonc`, GitHub Actions, generated
artifacts, or repository documentation beyond its name and lifecycle.

- [ ] **Step 4: Harden guarded workflow policy assertions**

Do not change `.github/workflows/preview.yml`. Extend its existing unit tests
to prove the deploy and safe-tail jobs remain mutually exclusive and that:

```ts
expect(preview).not.toContain("PREVIEW_RESTORE_DATABASE_URL");
expect(preview).not.toContain("PREVIEW_RESTORE_TARGET_ID");
expect(preview).not.toContain("echo \"$");
```

The safe-tail job continues to pipe Wrangler JSON directly to
`scripts/print-safe-tail.ts` and never stores raw logs as an artifact.

- [ ] **Step 5: Add client-bundle and release-scan assertions**

Extend `tests/security/secret-bundle.test.ts` so the temporary secret names,
restore evidence type, target identity, and any fixture sentinel are absent
from built client assets. Keep the server Worker bundle allowed to reference
the two secret names but not any values.

- [ ] **Step 6: Record temporary credential intent without values**

Add pending lifecycle rows to `credential-change-log.md` only when the secrets
are actually configured. Before that action, document in `secrets.md` that both
temporary entries are preview-only, target-only, removed after restore, and
never copied into GitHub.

- [ ] **Step 7: Run the complete candidate verification**

Run sequentially:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd test:e2e
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
git diff --check
```

Expected: every command exits zero. Record exact test counts without copying
private values.

- [ ] **Step 8: Commit and independently review the temporary candidate**

```powershell
git add -- wrangler.jsonc scripts/validate-preview-deploy-config.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts tests/security/secret-bundle.test.ts docs/operations/secrets.md
git commit -m "ops: prepare temporary preview restore"
git push origin codex/phase-b-foundation
```

Generate one task-scoped review package from the Task 1 base through the
candidate head. Require specification compliance and code-quality approval
with zero Critical or Important findings before any provider change.

### Task 4: Execute restore, remove the temporary path, and delete the branch

**Files:**
- Delete: `src/jobs/temporary-preview-restore.ts`
- Delete: `docs/reference/simple/src/jobs/temporary-preview-restore.md`
- Delete: `docs/reference/technical/src/jobs/temporary-preview-restore.md`
- Delete: `tests/integration/jobs/temporary-preview-restore.test.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `src/server/env.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `wrangler.jsonc`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `tests/unit/server/env.test.ts`
- Modify: `tests/integration/jobs/backup-retention.test.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify: `tests/unit/server/wrangler-routing.test.ts`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `tests/security/secret-bundle.test.ts`
- Modify: `src/jobs/purge-expired-backups.ts`
- Modify: `docs/reference/simple/src/jobs/_folder.md`
- Modify: `docs/reference/technical/src/jobs/_folder.md`
- Modify: `docs/reference/simple/src/jobs/scheduled.md`
- Modify: `docs/reference/technical/src/jobs/scheduled.md`
- Modify: `docs/operations/secrets.md`
- Modify: `docs/operations/restore-drill.md`
- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/credential-change-log.md`
- Modify: `docs/operations/setbacks/INDEX.md`
- Modify: the applicable indexed incident file

**External actions already approved:**
- Configure the two named temporary preview Worker secrets without revealing
  their values.
- Deploy the reviewed preview-only candidate.
- Restore into and verify the attested disposable Neon branch.
- Remove both temporary Worker secrets.
- Permanently delete the disposable branch only after all cleanup gates pass.

- [ ] **Step 1: Configure temporary target secrets**

Transfer the disposable target URL and target identity directly through
signed-in provider controls into the two Cloudflare Worker secrets. Do not
display, copy to chat, save locally, or place either value in GitHub. Add
value-free `created` entries to `credential-change-log.md`.

- [ ] **Step 2: Deploy the immutable temporary candidate**

Dispatch the guarded preview workflow using the full reviewed candidate SHA.
Require verify, browser, build, generated-config validation, and deploy jobs to
pass. Record only the run number, commit, terminal status, and deployed version
identifier already classified as safe project evidence.

- [ ] **Step 3: Capture one safe restore result**

Dispatch the guarded safe-tail workflow before the next every-minute trigger.
Accept only `vision.preview-restore/v1`. If outcome is failed, missing, or
ambiguous, stop: redeploy normal code, keep the branch, log the category, and
do not continue to deletion.

- [ ] **Step 4: Verify the restored target**

Require the safe result to prove:

```text
outcome=succeeded
category=none
format=vision-backup/v1
schemaVersion=9
authoritativeTableCount=29
checksumMatches=true
referencesValid=true
targetWasEmpty=true
eventListReadable=true
replacedExisting=false
```

Record aggregate row counts, event count, and the already-approved plaintext
checksum only in `restore-drill.md`. Do not record target or object identity.

- [ ] **Step 5: Remove temporary code and configuration**

Delete the temporary module, its temporary-only tests and references, both
temporary env fields/schema, temporary scheduled dependency, third cron,
restore tail shape, and temporary operations wording. Restore the exact normal
two-cron configuration and keep the permanent restore evidence documents.

- [ ] **Step 6: Run the complete cleanup verification**

Run:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd test:e2e
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
git diff --check
```

Expected: every command exits zero, no temporary source/reference remains, no
event write surface appears, and no secret name reaches client assets.

- [ ] **Step 7: Commit, review, push, and deploy cleanup**

```powershell
git add -- src/jobs/temporary-preview-restore.ts src/jobs/scheduled.ts src/jobs/purge-expired-backups.ts src/server/env.ts scripts/safe-tail-classifier.ts scripts/print-safe-tail.ts scripts/validate-preview-deploy-config.ts wrangler.jsonc tests/integration/jobs/temporary-preview-restore.test.ts tests/integration/jobs/backup-retention.test.ts tests/integration/jobs/daily-backup.test.ts tests/unit/server/env.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts tests/security/secret-bundle.test.ts docs/reference/simple/src/jobs/temporary-preview-restore.md docs/reference/technical/src/jobs/temporary-preview-restore.md docs/reference/simple/src/jobs/_folder.md docs/reference/technical/src/jobs/_folder.md docs/reference/simple/src/jobs/scheduled.md docs/reference/technical/src/jobs/scheduled.md docs/operations/secrets.md docs/operations/restore-drill.md docs/operations/phase-b-evidence.md docs/operations/credential-change-log.md docs/operations/setbacks/INDEX.md docs/operations/setbacks/incidents/2026-07-27T011929Z-backup-key-not-retained-for-restore.md
git commit -m "chore: remove temporary preview restore"
git push origin codex/phase-b-foundation
```

Independently review the cleanup diff, dispatch the guarded preview workflow
with the full cleanup SHA, and require exact deployment attribution plus live
health.

- [ ] **Step 8: Delete only the two temporary secrets**

Delete `PREVIEW_RESTORE_DATABASE_URL` and `PREVIEW_RESTORE_TARGET_ID` from the
preview Worker. Do not modify `BACKUP_ENCRYPTION_KEY`,
`BACKUP_KEY_VERSION`, `KEY_ENCRYPTION_KEY`, Google credentials, or AI
credentials. Add value-free `deleted` entries to the credential log.

- [ ] **Step 9: Verify normal runtime before branch deletion**

Confirm the deployed Worker has only the 15-minute maintenance and daily
recovery schedules, the private desk is healthy, the deployment matches the
reviewed cleanup commit, and the temporary secrets are absent by name only.

- [ ] **Step 10: Permanently delete the disposable Neon branch**

Resolve the exact already-attested disposable target inside the signed-in Neon
provider control, re-confirm it is not the preview primary branch, and
permanently delete only that branch. Record a boolean deletion result and UTC
timestamp, never its identifier.

- [ ] **Step 11: Close restore evidence and blocker**

Mark every restore-drill checklist item passed, update
`phase-b-evidence.md`, close the retained-key incident with correction and
prevention, run `pnpm.cmd docs:check` and `git diff --check`, then commit and
push:

```powershell
git add -- docs/operations
git commit -m "docs: complete encrypted restore drill"
git push origin codex/phase-b-foundation
```

The broader Phase B goal remains active for the independent Google,
operational-failure, privacy, AI-cost, final deployment, and Phase C handoff
gates.
