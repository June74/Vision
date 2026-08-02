# OAuth Reconnect Authorization Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover only Vision's exact stale scheduler-owned Google authorization disconnect after a valid owner reconnect, before creating or rotating a Vision session.

**Architecture:** The OAuth callback passes authoritative token version and update-time metadata to one narrow recovery port immediately after encrypted token persistence. An owner-scoped repository classifies and, only for the exact complete scheduler marker, clears checkpoint and marker state in one locked SQL statement with a forced rollback assertion if the two updates do not both occur. Focused PGlite, Worker, and explicitly approved disposable-PostgreSQL tests prove closed outcomes, ordering, privacy, preservation, and interleavings before exact-commit preview deployment and live verification.

**Tech Stack:** TypeScript 5.9, Hono, Drizzle SQL, Neon PostgreSQL, PGlite, Vitest 4, Cloudflare Workers, pnpm on Windows PowerShell.

## Global Constraints

- Version 1 remains a single-private-owner product; every recovery query is permanently scoped to the repository's constructor-bound owner.
- Callback order is exactly token persistence, guarded authorization recovery, prior-session revocation, then new-session creation.
- The only new safe callback category is `authorization_recovery_failed`; raw errors and state values never reach the response or operational log.
- `recovered` and `not_needed` continue authentication; `conflict`, an unexpected outcome, or a thrown recovery error fails before session rotation or creation.
- Recovery targets only an exact `disconnected / authorization` checkpoint whose complete three-field scheduler marker matches checkpoint version, category, and timestamp and predates the persisted token update.
- Token subject, token version, token update time, connected setup, canonical owner `Vision` connection, checkpoint version, maintenance version, and marker fields are all guarded in the same SQL statement.
- Checkpoint clear and maintenance-marker clear must both update exactly one row or the statement must throw so PostgreSQL rolls the entire statement back.
- Preserve sync-token ciphertext, key version, committed time, checkpoint version, calendar setup, connection, channels, jobs, renewal state, leases, counters, cleanup state, events, categories, graph, AI, backups, sessions, and audit data.
- Add no route, UI control, cron, Queue, binding, environment variable, secret, provider resource, database table, or migration.
- Never read, print, request, copy, or rotate encryption or backup keys. Preview backup key version remains `1`.
- The real PostgreSQL interleaving suite may run only against an explicitly approved disposable test database and generated test-only schemas; it must never use preview owner data.
- Never print callback URLs, authorization codes, tokens, database URLs, keys, email addresses, subjects, owner IDs, provider IDs, run handles, correlations, nonces, object keys, hashes, event content, or raw logs.
- Before asking the owner to interact with Google, verify every non-credential part of the deployed path locally and remotely. Only the owner may choose an account or grant consent.
- Keep all setback and credential-ledger changes unstaged through this repair; the authoritative Phase B Task 10 process reviews and commits them separately.
- Use `.\node_modules\.bin\vitest.cmd`, never `pnpm exec vitest`.
- Use at most one active subagent at a time on this workstation.

## File Structure

- `src/data/repositories/channel-maintenance-repository.ts` owns the closed outcome type and the single owner-scoped SQL transition.
- `src/server/auth/oauth-routes.ts` owns the narrow callback port, stage ordering, safe failure category, and production dependency wiring.
- `tests/integration/jobs/channel-maintenance-adversarial.test.ts` proves deterministic repository behavior and preservation on PGlite.
- `tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts` proves real multi-session lock and rollback behavior in generated disposable schemas.
- `tests/contract/google/oauth.contract.test.ts` proves one parameterized owner-scoped SQL statement, dependent row locks, both guarded writes, monotonic maintenance time, and strict result decoding.
- `tests/worker/auth.test.ts` proves callback ordering, port inputs, session behavior, durable token persistence, and response/log privacy.
- The four existing simple/technical reference files mirror the two changed production modules; no new documentation subtree is introduced.

Before Task 1, capture the exact reviewed planning tip and the verified remote
parent without printing child Git output:

```powershell
$implementationBase = git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" rev-parse HEAD
$remoteParent = git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" rev-parse refs/remotes/origin/codex/phase-b-foundation
if ($implementationBase -notmatch '^[a-f0-9]{40}$' -or $remoteParent -notmatch '^[a-f0-9]{40}$') {
  throw 'Reconnect implementation boundaries are not canonical'
}
$planningPaths = @(
  'docs/superpowers/specs/2026-08-02-oauth-reconnect-authorization-recovery-design.md',
  'docs/superpowers/plans/2026-08-02-oauth-reconnect-authorization-recovery.md'
)
$unexpectedPlanningDelta = @(
  git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --name-only "$remoteParent..$implementationBase" |
    Where-Object { $_ -notin $planningPaths }
)
if ($unexpectedPlanningDelta.Count -ne 0) {
  throw 'Planning tip differs from the previous reviewed application artifact'
}
.\node_modules\.bin\tsx.cmd scripts/privacy-safe-git-remote.ts assert_tip --branch codex/phase-b-foundation --expected-commit $remoteParent
```

Expected sole adapter stdout: `True`. Retain both values only in ignored local
evidence for the duration of this repair. The path check proves that
`$implementationBase` has the same deployable application tree as the previous
reviewed normal remote artifact; only the owner-reviewed spec and plan may
differ.

---

### Task 1: Owner-Scoped Authorization Recovery Repository

**Files:**

- Modify: `tests/integration/jobs/channel-maintenance-adversarial.test.ts`
- Modify: `tests/contract/google/oauth.contract.test.ts`
- Modify: `src/data/repositories/channel-maintenance-repository.ts`
- Modify: `docs/reference/simple/src/data/repositories/channel-maintenance-repository.md`
- Modify: `docs/reference/technical/src/data/repositories/channel-maintenance-repository.md`

**Interfaces:**

- Consumes: existing `VisionDatabase`, constructor-bound `ownerId`, `google_oauth_tokens`, `calendar_setup_states`, `vision_calendar_connections`, `sync_checkpoints`, and `calendar_sync_maintenance` rows.
- Produces:

  ```ts
  export type AuthorizationRecoveryOutcome =
    | "recovered"
    | "not_needed"
    | "conflict";

  export interface AuthorizationReconnectInput {
    readonly googleSubject: string;
    readonly tokenVersion: number;
    readonly tokenUpdatedAt: Date;
  }

  ChannelMaintenanceRepository.recoverAuthorizationAfterReconnect(
    input: AuthorizationReconnectInput,
  ): Promise<AuthorizationRecoveryOutcome>;
  ```

- [ ] **Step 1: Extend the PGlite fixture with token and recovery seeds**

Add `google_oauth_tokens` to the existing `beforeEach` truncate list, then add these constants and helpers beside `seedCanonicalConnection()` and `seedCheckpoint()`:

```ts
const AUTHORIZATION_FAILURE_AT = new Date(NOW.getTime() + 1_000);
const RECONNECT_TOKEN_AT = new Date(NOW.getTime() + 4_000);

async function seedGoogleToken(input: {
  ownerId?: string;
  googleSubject?: string;
  tokenVersion?: number;
  updatedAt?: Date;
} = {}): Promise<void> {
  await postgres.query(
    `insert into google_oauth_tokens (
       owner_id, google_subject, refresh_token_envelope,
       refresh_token_digest, access_token_envelope, access_expires_at,
       granted_scopes, token_version, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.ownerId ?? OWNER,
      input.googleSubject ?? "subject-1",
      new Uint8Array([7]),
      "D".repeat(43),
      new Uint8Array([8]),
      new Date(RECONNECT_TOKEN_AT.getTime() + 3_600_000).toISOString(),
      "https://www.googleapis.com/auth/calendar.readonly",
      input.tokenVersion ?? 2,
      (input.updatedAt ?? RECONNECT_TOKEN_AT).toISOString(),
    ],
  );
}

async function seedSchedulerAuthorizationDisconnect(): Promise<
  ReturnType<typeof createChannelMaintenanceRepository>
> {
  await seedCanonicalConnection();
  await seedCheckpoint();
  const repository = createChannelMaintenanceRepository(database, OWNER);
  await repository.bootstrapConnectedCalendars(NOW);
  expect(
    await repository.recordCredentialFailure(
      new SyncCalendarError("authorization", "disconnected", false),
      AUTHORIZATION_FAILURE_AT,
    ),
  ).toBe(true);
  await seedGoogleToken();
  return repository;
}

async function readRecoveryFacts(): Promise<readonly Record<string, unknown>[]> {
  return (
    await postgres.query(
      `select
         checkpoint.id,
         checkpoint.sync_token_envelope,
         checkpoint.key_version,
         checkpoint.committed_at,
         checkpoint.version,
         checkpoint.status,
         checkpoint.last_error_category,
         checkpoint.updated_at as checkpoint_updated_at,
         maintenance.connection_version,
         maintenance.checkpoint_version,
         maintenance.renewal_generation,
         maintenance.renewal_failures,
         maintenance.renewal_lease_id,
         maintenance.renewal_lease_expires_at,
         maintenance.current_channel_row_id,
         maintenance.credential_failure_checkpoint_version,
         maintenance.credential_failure_category,
         maintenance.credential_failure_recorded_at,
         maintenance.updated_at as maintenance_updated_at
       from sync_checkpoints as checkpoint
       inner join calendar_sync_maintenance as maintenance
         on maintenance.owner_id = checkpoint.owner_id
        and maintenance.provider = checkpoint.provider
        and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
       where checkpoint.owner_id = $1`,
      [OWNER],
    )
  ).rows;
}
```

- [ ] **Step 2: Write RED exact-recovery, idempotency, and preservation tests**

Append this focused behavior before the existing credential-race tests:

```ts
it("recovers the exact scheduler authorization marker once and preserves sync state", async () => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  await postgres.query(
    `insert into sync_channels (
       id, owner_id, provider, provider_calendar_id, provider_channel_id,
       provider_resource_id, verification_token_envelope,
       verification_token_hash, expires_at, lifecycle, created_at,
       activated_at, failure_count
     ) values (
       'channel-preserved', $1, 'google-calendar', $2, 'channel-opaque',
       'resource-opaque', $3, $4, $5, 'active', $6, $6, 3
     )`,
    [
      OWNER,
      CALENDAR,
      new Uint8Array([9]),
      "H".repeat(43),
      new Date(NOW.getTime() + 86_400_000).toISOString(),
      NOW.toISOString(),
    ],
  );
  await postgres.query(
    `update calendar_sync_maintenance
     set current_channel_row_id = 'channel-preserved',
         renewal_generation = 6,
         renewal_failures = 3,
         renewal_lease_id = 'lease-preserved',
         renewal_lease_expires_at = $1
     where owner_id = $2`,
    [new Date(RECONNECT_TOKEN_AT.getTime() + 60_000).toISOString(), OWNER],
  );
  await postgres.query(
    `insert into calendar_sync_jobs (
       job_id, owner_id, provider, provider_calendar_id, reason, status,
       attempts, action_required, created_at, updated_at
     ) values (
       'job-preserved', $1, 'google-calendar', $2, 'repair',
       'enqueued', 2, false, $3, $3
     )`,
    [OWNER, CALENDAR, NOW.toISOString()],
  );
  const channelBefore = (await postgres.query(`select * from sync_channels`)).rows;
  const jobBefore = (await postgres.query(`select * from calendar_sync_jobs`)).rows;
  const topologyBefore = (
    await postgres.query(
      `select setup.*, connection.*
       from calendar_setup_states as setup
       inner join vision_calendar_connections as connection
         on connection.owner_id = setup.owner_id
       where setup.owner_id = $1`,
      [OWNER],
    )
  ).rows;

  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("recovered");

  expect(await readRecoveryFacts()).toEqual([
    expect.objectContaining({
      id: "checkpoint-1",
      sync_token_envelope: new Uint8Array([1]),
      key_version: 1,
      committed_at: NOW,
      version: 1,
      status: "connected",
      last_error_category: null,
      checkpoint_updated_at: RECONNECT_TOKEN_AT,
      connection_version: 4,
      checkpoint_version: 1,
      renewal_generation: 6,
      renewal_failures: 3,
      renewal_lease_id: "lease-preserved",
      renewal_lease_expires_at: new Date(RECONNECT_TOKEN_AT.getTime() + 60_000),
      current_channel_row_id: "channel-preserved",
      credential_failure_checkpoint_version: null,
      credential_failure_category: null,
      credential_failure_recorded_at: null,
      maintenance_updated_at: RECONNECT_TOKEN_AT,
    }),
  ]);
  expect((await postgres.query(`select * from sync_channels`)).rows).toEqual(channelBefore);
  expect((await postgres.query(`select * from calendar_sync_jobs`)).rows).toEqual(jobBefore);
  expect(
    (
      await postgres.query(
        `select setup.*, connection.*
         from calendar_setup_states as setup
         inner join vision_calendar_connections as connection
           on connection.owner_id = setup.owner_id
         where setup.owner_id = $1`,
        [OWNER],
      )
    ).rows,
  ).toEqual(topologyBefore);

  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("not_needed");
});

it("never moves a newer maintenance timestamp backward", async () => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  const newerMaintenanceAt = new Date(RECONNECT_TOKEN_AT.getTime() + 1_000);
  await postgres.query(
    `update calendar_sync_maintenance set updated_at = $1 where owner_id = $2`,
    [newerMaintenanceAt.toISOString(), OWNER],
  );
  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("recovered");
  expect(
    (
      await postgres.query(
        `select updated_at from calendar_sync_maintenance where owner_id = $1`,
        [OWNER],
      )
    ).rows,
  ).toEqual([{ updated_at: newerMaintenanceAt }]);
});
```

- [ ] **Step 3: Write RED closed-outcome matrix tests**

Add three table-driven groups. Each mutation is explicit and each conflict test snapshots `readRecoveryFacts()` before the call and requires byte-for-byte equality afterward.

```ts
it.each([
  ["no setup", async () => { await seedGoogleToken(); }],
  ["non-connected setup", async () => {
    await postgres.query(
      `insert into calendar_setup_states (
         owner_id, google_subject, setup_version, status, action_required, updated_at
       ) values ($1, 'subject-1', 1, 'authenticated', false, $2)`,
      [OWNER, NOW.toISOString()],
    );
    await seedGoogleToken();
  }],
] as const)("returns not_needed for %s", async (_name, arrange) => {
  await arrange();
  const repository = createChannelMaintenanceRepository(database, OWNER);
  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("not_needed");
});

it.each([
  ["connected and unmarked", async () => undefined],
  ["unrelated retry", async () => {
    await postgres.query(
      `update sync_checkpoints
       set status = 'retry_scheduled', last_error_category = 'transient', updated_at = $1
       where owner_id = $2`,
      [AUTHORIZATION_FAILURE_AT.toISOString(), OWNER],
    );
    await postgres.query(
      `update calendar_sync_maintenance
       set credential_failure_category = 'transient'
       where owner_id = $1`,
      [OWNER],
    );
  }],
  ["unrelated provider state", async () => {
    await postgres.query(
      `update sync_checkpoints
       set status = 'action_required', last_error_category = 'provider', updated_at = $1
       where owner_id = $2`,
      [AUTHORIZATION_FAILURE_AT.toISOString(), OWNER],
    );
  }],
] as const)("leaves %s as not_needed", async (name, mutate) => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  if (name === "connected and unmarked") {
    await postgres.query(
      `update sync_checkpoints
       set status = 'connected', last_error_category = null, updated_at = $1
       where owner_id = $2`,
      [RECONNECT_TOKEN_AT.toISOString(), OWNER],
    );
    await postgres.query(
      `update calendar_sync_maintenance
       set credential_failure_checkpoint_version = null,
           credential_failure_category = null,
           credential_failure_recorded_at = null
       where owner_id = $1`,
      [OWNER],
    );
  } else {
    await mutate();
  }
  const before = await readRecoveryFacts();
  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("not_needed");
  expect(await readRecoveryFacts()).toEqual(before);
});

it.each([
  ["missing connection", `delete from vision_calendar_connections where owner_id = $1`, [OWNER]],
  ["connection version mismatch", `update calendar_sync_maintenance set connection_version = 5 where owner_id = $1`, [OWNER]],
  ["checkpoint version mismatch", `update calendar_sync_maintenance set checkpoint_version = 0 where owner_id = $1`, [OWNER]],
  ["unmarked target", `update calendar_sync_maintenance set credential_failure_checkpoint_version = null, credential_failure_category = null, credential_failure_recorded_at = null where owner_id = $1`, [OWNER]],
  ["marker version mismatch", `update calendar_sync_maintenance set credential_failure_checkpoint_version = 0 where owner_id = $1`, [OWNER]],
  ["marker category mismatch", `update calendar_sync_maintenance set credential_failure_category = 'transient' where owner_id = $1`, [OWNER]],
  ["marker time mismatch", `update calendar_sync_maintenance set credential_failure_recorded_at = $1 where owner_id = $2`, [new Date(AUTHORIZATION_FAILURE_AT.getTime() - 1).toISOString(), OWNER]],
  ["connected checkpoint with marker", `update sync_checkpoints set status = 'connected', last_error_category = null where owner_id = $1`, [OWNER]],
] as const)("returns conflict without mutation for %s", async (_name, statement, parameters) => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  await postgres.query(statement, [...parameters]);
  const before = await readRecoveryFacts();
  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("conflict");
  expect(await readRecoveryFacts()).toEqual(before);
});

it.each(["checkpoint", "maintenance"] as const)(
  "returns conflict and preserves the surviving row when %s is missing",
  async (missing) => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    if (missing === "checkpoint") {
      await postgres.query(`delete from sync_checkpoints where owner_id = $1`, [OWNER]);
    } else {
      await postgres.query(
        `delete from calendar_sync_maintenance where owner_id = $1`,
        [OWNER],
      );
    }
    const survivingTable =
      missing === "checkpoint" ? "calendar_sync_maintenance" : "sync_checkpoints";
    const before = (
      await postgres.query(`select * from ${survivingTable} where owner_id = $1`, [OWNER])
    ).rows;
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("conflict");
    expect(
      (
        await postgres.query(
          `select * from ${survivingTable} where owner_id = $1`,
          [OWNER],
        )
      ).rows,
    ).toEqual(before);
  },
);

it("fails closed when connected setup no longer matches the token subject", async () => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  await postgres.query(
    `update calendar_setup_states set google_subject = 'subject-mismatch'
     where owner_id = $1`,
    [OWNER],
  );
  await postgres.query(
    `update vision_calendar_connections set google_subject = 'subject-mismatch'
     where owner_id = $1`,
    [OWNER],
  );
  const before = await readRecoveryFacts();
  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("conflict");
  expect(await readRecoveryFacts()).toEqual(before);
});

it.each([0, 1] as const)(
  "rejects a marker that is simultaneous with or newer than the token",
  async (offsetMilliseconds) => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    const markerAt = new Date(RECONNECT_TOKEN_AT.getTime() + offsetMilliseconds);
    await postgres.query(
      `update sync_checkpoints set updated_at = $1 where owner_id = $2`,
      [markerAt.toISOString(), OWNER],
    );
    await postgres.query(
      `update calendar_sync_maintenance
       set credential_failure_recorded_at = $1 where owner_id = $2`,
      [markerAt.toISOString(), OWNER],
    );
    const before = await readRecoveryFacts();
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("conflict");
    expect(await readRecoveryFacts()).toEqual(before);
  },
);
```

Add separate exact-token conflict assertions for subject, version, and update time, because those values are method inputs rather than fixture mutations:

```ts
it.each([
  ["other-subject", 2, RECONNECT_TOKEN_AT],
  ["subject-1", 1, RECONNECT_TOKEN_AT],
  ["subject-1", 2, new Date(RECONNECT_TOKEN_AT.getTime() - 1)],
] as const)(
  "fails closed when authoritative token metadata no longer matches",
  async (googleSubject, tokenVersion, tokenUpdatedAt) => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    const before = await readRecoveryFacts();
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject,
        tokenVersion,
        tokenUpdatedAt,
      }),
    ).resolves.toBe("conflict");
    expect(await readRecoveryFacts()).toEqual(before);
  },
);
```

Add this cross-owner proof with a distinct subject, calendar, token digest,
checkpoint ID, and maintenance primary key:

```ts
it("cannot observe or change another owner's recovery topology", async () => {
  const repository = await seedSchedulerAuthorizationDisconnect();
  const otherOwner = "owner-2";
  const otherSubject = "subject-2";
  const otherCalendar = "calendar-2";
  await postgres.query(
    `insert into calendar_setup_states (
       owner_id, google_subject, setup_version, status, action_required, updated_at
     ) values ($1, $2, 9, 'connected', false, $3)`,
    [otherOwner, otherSubject, NOW.toISOString()],
  );
  await postgres.query(
    `insert into vision_calendar_connections (
       owner_id, google_subject, provider_calendar_id, summary,
       ownership_access_role, time_zone, provider_etag, verified_at,
       connection_kind
     ) values ($1, $2, $3, 'Vision', 'owner', 'America/Chicago',
       'etag-other', $4, 'existing')`,
    [otherOwner, otherSubject, otherCalendar, NOW.toISOString()],
  );
  await postgres.query(
    `insert into sync_checkpoints (
       id, owner_id, provider, provider_calendar_id, sync_token_envelope,
       key_version, committed_at, version, status, last_error_category, updated_at
     ) values ('checkpoint-2', $1, 'google-calendar', $2, $3, 1, $4, 1,
       'disconnected', 'authorization', $4)`,
    [otherOwner, otherCalendar, new Uint8Array([4]), AUTHORIZATION_FAILURE_AT.toISOString()],
  );
  await postgres.query(
    `insert into calendar_sync_maintenance (
       owner_id, provider, provider_calendar_id, connection_version,
       checkpoint_version, renewal_generation, renewal_failures,
       credential_failure_checkpoint_version, credential_failure_category,
       credential_failure_recorded_at, created_at, updated_at
     ) values ($1, 'google-calendar', $2, 9, 1, 8, 5, 1,
       'authorization', $3, $4, $4)`,
    [otherOwner, otherCalendar, AUTHORIZATION_FAILURE_AT.toISOString(), NOW.toISOString()],
  );
  await postgres.query(
    `insert into google_oauth_tokens (
       owner_id, google_subject, refresh_token_envelope,
       refresh_token_digest, access_token_envelope, access_expires_at,
       granted_scopes, token_version, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, 4, $8)`,
    [
      otherOwner,
      otherSubject,
      new Uint8Array([5]),
      "X".repeat(43),
      new Uint8Array([6]),
      new Date(RECONNECT_TOKEN_AT.getTime() + 3_600_000).toISOString(),
      "https://www.googleapis.com/auth/calendar.readonly",
      RECONNECT_TOKEN_AT.toISOString(),
    ],
  );
  const before = (
    await postgres.query(
      `select checkpoint.*, maintenance.*
       from sync_checkpoints as checkpoint
       inner join calendar_sync_maintenance as maintenance
         on maintenance.owner_id = checkpoint.owner_id
        and maintenance.provider = checkpoint.provider
        and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
       where checkpoint.owner_id = $1`,
      [otherOwner],
    )
  ).rows;

  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject-1",
      tokenVersion: 2,
      tokenUpdatedAt: RECONNECT_TOKEN_AT,
    }),
  ).resolves.toBe("recovered");
  expect(
    (
      await postgres.query(
        `select checkpoint.*, maintenance.*
         from sync_checkpoints as checkpoint
         inner join calendar_sync_maintenance as maintenance
           on maintenance.owner_id = checkpoint.owner_id
          and maintenance.provider = checkpoint.provider
          and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
         where checkpoint.owner_id = $1`,
        [otherOwner],
      )
    ).rows,
  ).toEqual(before);
});
```

- [ ] **Step 4: Run the focused repository tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/jobs/channel-maintenance-adversarial.test.ts --project unit
```

Expected: FAIL only because `recoverAuthorizationAfterReconnect` does not exist; all pre-existing calendar-maintenance tests still execute without a new fixture failure.

- [ ] **Step 5: Add the closed contract and one-statement repository implementation**

Add the exported type and input interface above `ChannelMaintenanceRepository`, then add this method between `recordCredentialFailure()` and `clearCredentialRetry()`:

```ts
/** Closed result of one owner-scoped authorization reconnect reconciliation. */
export type AuthorizationRecoveryOutcome =
  | "recovered"
  | "not_needed"
  | "conflict";

/** Authoritative token metadata returned by the encrypted token upsert. */
export interface AuthorizationReconnectInput {
  readonly googleSubject: string;
  readonly tokenVersion: number;
  readonly tokenUpdatedAt: Date;
}

/** Recovers only an exact older scheduler authorization marker after reconnect. */
async recoverAuthorizationAfterReconnect(
  input: AuthorizationReconnectInput,
): Promise<AuthorizationRecoveryOutcome> {
  const googleSubject = readText(input.googleSubject);
  const tokenVersion = readPositiveInteger(input.tokenVersion);
  const tokenUpdatedAt = readDate(input.tokenUpdatedAt);
  const result = await this.database.execute<Record<string, unknown>>(sql`
    with locked_token as materialized (
      select token.owner_id, token.google_subject, token.token_version, token.updated_at
      from google_oauth_tokens as token
      where token.owner_id = ${this.ownerId}
      for update of token
    ),
    exact_token as materialized (
      select *
      from locked_token
      where google_subject = ${googleSubject}
        and token_version = ${tokenVersion}
        and updated_at = ${tokenUpdatedAt}
    ),
    locked_setup as materialized (
      select setup.*
      from calendar_setup_states as setup
      where setup.owner_id = ${this.ownerId}
        and exists (select 1 from exact_token)
      for update of setup
    ),
    locked_connection as materialized (
      select connection.*
      from vision_calendar_connections as connection
      inner join locked_setup as setup
        on setup.owner_id = connection.owner_id
       and setup.status = 'connected'
      where connection.owner_id = ${this.ownerId}
      for update of connection
    ),
    locked_checkpoint as materialized (
      select checkpoint.*
      from sync_checkpoints as checkpoint
      inner join locked_connection as connection
        on connection.owner_id = checkpoint.owner_id
       and connection.provider_calendar_id = checkpoint.provider_calendar_id
      where checkpoint.owner_id = ${this.ownerId}
        and checkpoint.provider = 'google-calendar'
      for update of checkpoint
    ),
    locked_maintenance as materialized (
      select maintenance.*
      from calendar_sync_maintenance as maintenance
      inner join locked_checkpoint as checkpoint
        on checkpoint.owner_id = maintenance.owner_id
       and checkpoint.provider = maintenance.provider
       and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
      where maintenance.owner_id = ${this.ownerId}
        and maintenance.provider = 'google-calendar'
      for update of maintenance
    ),
    topology as materialized (
      select
        token.updated_at as token_updated_at,
        checkpoint.owner_id,
        checkpoint.provider,
        checkpoint.provider_calendar_id,
        checkpoint.version as checkpoint_version,
        checkpoint.status as checkpoint_status,
        checkpoint.last_error_category as checkpoint_category,
        checkpoint.updated_at as checkpoint_updated_at,
        maintenance.credential_failure_checkpoint_version as marker_version,
        maintenance.credential_failure_category as marker_category,
        maintenance.credential_failure_recorded_at as marker_recorded_at
      from exact_token as token
      inner join locked_setup as setup
        on setup.owner_id = token.owner_id
       and setup.google_subject = token.google_subject
       and setup.status = 'connected'
      inner join locked_connection as connection
        on connection.owner_id = setup.owner_id
       and connection.google_subject = setup.google_subject
       and connection.summary = 'Vision'
       and connection.ownership_access_role = 'owner'
      inner join locked_checkpoint as checkpoint
        on checkpoint.owner_id = connection.owner_id
       and checkpoint.provider = 'google-calendar'
       and checkpoint.provider_calendar_id = connection.provider_calendar_id
      inner join locked_maintenance as maintenance
        on maintenance.owner_id = checkpoint.owner_id
       and maintenance.provider = checkpoint.provider
       and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
       and maintenance.connection_version = setup.setup_version
       and maintenance.checkpoint_version = checkpoint.version
    ),
    decision as materialized (
      select case
        when not exists (select 1 from exact_token) then 'conflict'
        when not exists (select 1 from locked_setup) then 'not_needed'
        when exists (
          select 1 from locked_setup where status <> 'connected'
        ) then 'not_needed'
        when not exists (select 1 from topology) then 'conflict'
        when exists (
          select 1
          from topology
          where checkpoint_status = 'connected'
            and (
              marker_version is not null
              or marker_category is not null
              or marker_recorded_at is not null
            )
        ) then 'conflict'
        when exists (
          select 1
          from topology
          where checkpoint_status = 'disconnected'
            and checkpoint_category = 'authorization'
            and marker_version = checkpoint_version
            and marker_category = 'authorization'
            and marker_recorded_at = checkpoint_updated_at
            and marker_recorded_at < token_updated_at
        ) then 'recovered'
        when exists (
          select 1
          from topology
          where checkpoint_status = 'disconnected'
            and checkpoint_category = 'authorization'
        ) then 'conflict'
        else 'not_needed'
      end as outcome
    ),
    recovered_checkpoint as (
      update sync_checkpoints as checkpoint
      set status = 'connected',
          last_error_category = null,
          updated_at = ${tokenUpdatedAt}
      from topology, decision
      where decision.outcome = 'recovered'
        and checkpoint.owner_id = topology.owner_id
        and checkpoint.provider = topology.provider
        and checkpoint.provider_calendar_id = topology.provider_calendar_id
        and checkpoint.version = topology.checkpoint_version
        and checkpoint.status = 'disconnected'
        and checkpoint.last_error_category = 'authorization'
        and checkpoint.updated_at = topology.checkpoint_updated_at
      returning checkpoint.owner_id, checkpoint.provider,
        checkpoint.provider_calendar_id, checkpoint.version
    ),
    recovered_maintenance as (
      update calendar_sync_maintenance as maintenance
      set credential_failure_checkpoint_version = null,
          credential_failure_category = null,
          credential_failure_recorded_at = null,
          updated_at = greatest(maintenance.updated_at, ${tokenUpdatedAt})
      from topology, recovered_checkpoint
      where maintenance.owner_id = recovered_checkpoint.owner_id
        and maintenance.provider = recovered_checkpoint.provider
        and maintenance.provider_calendar_id = recovered_checkpoint.provider_calendar_id
        and maintenance.checkpoint_version = recovered_checkpoint.version
        and maintenance.credential_failure_checkpoint_version = topology.marker_version
        and maintenance.credential_failure_category = topology.marker_category
        and maintenance.credential_failure_recorded_at = topology.marker_recorded_at
      returning maintenance.owner_id
    ),
    asserted as materialized (
      select (
        case
          when decision.outcome = 'recovered'
            and (select count(*) from recovered_checkpoint) = 1
            and (select count(*) from recovered_maintenance) = 1
          then '1'
          when decision.outcome <> 'recovered'
            and (select count(*) from recovered_checkpoint) = 0
            and (select count(*) from recovered_maintenance) = 0
          then '1'
          else 'authorization_recovery_atomicity_violation'
        end
      )::integer as ok
      from decision
    )
    select decision.outcome
    from decision
    cross join asserted
    where asserted.ok = 1
  `);
  const outcome = result.rows.length === 1 ? result.rows[0]?.outcome : undefined;
  if (
    outcome !== "recovered" &&
    outcome !== "not_needed" &&
    outcome !== "conflict"
  ) {
    throw new Error("Invalid authorization recovery row.");
  }
  return outcome;
}
```

The dependent materialized lock CTEs establish token, setup, connection, checkpoint, then maintenance lock order. The data-dependent integer cast in `asserted` is referenced by the final query; any one-sided update makes that cast fail at execution time and PostgreSQL rolls back the entire statement.

- [ ] **Step 6: Run focused repository tests to GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/jobs/channel-maintenance-adversarial.test.ts --project unit
pnpm.cmd typecheck
```

Expected: the focused file passes with no skipped recovery case, and both TypeScript projects report zero diagnostics.

- [ ] **Step 7: Add the parameterization, lock-chain, and decoder contract tests**

Import `createChannelMaintenanceRepository` into
`tests/contract/google/oauth.contract.test.ts`, then append:

```ts
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
```

```ts
it("uses one parameterized owner-scoped statement for reconnect recovery", async () => {
  const statements: SQL[] = [];
  const database = {
    execute: async (statement: SQL) => {
      statements.push(statement);
      return { rows: [{ outcome: "not_needed" }] };
    },
  } as unknown as VisionDatabase;
  const repository = createChannelMaintenanceRepository(
    database,
    "owner_reconnect_contract",
  );

  await expect(
    repository.recoverAuthorizationAfterReconnect({
      googleSubject: "subject_reconnect_contract",
      tokenVersion: 7,
      tokenUpdatedAt: new Date("2026-08-02T05:00:00.000Z"),
    }),
  ).resolves.toBe("not_needed");
  expect(statements).toHaveLength(1);
  const compiled = dialect.sqlToQuery(statements[0]!);
  const rendered = compiled.sql.replace(/\s+/gu, " ").toLowerCase();
  for (const fragment of [
    "with locked_token as materialized",
    "from locked_token",
    "locked_setup as materialized",
    "inner join locked_setup",
    "locked_connection as materialized",
    "inner join locked_connection",
    "locked_checkpoint as materialized",
    "inner join locked_checkpoint",
    "locked_maintenance as materialized",
    "for update of token",
    "for update of setup",
    "for update of connection",
    "for update of checkpoint",
    "for update of maintenance",
    "update sync_checkpoints",
    "update calendar_sync_maintenance",
    "from topology, recovered_checkpoint",
    "greatest(maintenance.updated_at",
    "authorization_recovery_atomicity_violation",
  ]) {
    expect(rendered).toContain(fragment);
  }
  expect(rendered).not.toContain("owner_reconnect_contract");
  expect(rendered).not.toContain("subject_reconnect_contract");
  expect(compiled.params).toContain("owner_reconnect_contract");
  expect(compiled.params).toContain("subject_reconnect_contract");
});

it.each([
  [],
  [{ outcome: "unknown" }],
  [{ outcome: "recovered" }, { outcome: "not_needed" }],
] as const)("rejects a non-single closed recovery result", async (rows) => {
  const database = {
    execute: async () => ({ rows: [...rows] }),
  } as unknown as VisionDatabase;
  await expect(
    createChannelMaintenanceRepository(
      database,
      "owner_reconnect_contract",
    ).recoverAuthorizationAfterReconnect({
      googleSubject: "subject_reconnect_contract",
      tokenVersion: 7,
      tokenUpdatedAt: new Date("2026-08-02T05:00:00.000Z"),
    }),
  ).rejects.toThrow("Invalid authorization recovery row.");
});
```

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contract/google/oauth.contract.test.ts --project contract
```

Expected: both new contract tests and every existing Google OAuth contract test pass.

- [ ] **Step 8: Document the repository method and run documentation coverage**

Add this heading to the simple reference:

```md
## `recoverAuthorizationAfterReconnect`
After a successful reconnect, clears only an older complete scheduler-owned authorization marker. It returns `not_needed` for ordinary first login or unrelated health, and `conflict` for ambiguous or newer state.
```

Add this heading to the technical reference:

```md
## `recoverAuthorizationAfterReconnect`
Locks the exact owner token, setup, canonical connection, checkpoint, and maintenance rows in one SQL statement. It requires exact token metadata plus a complete older `disconnected / authorization` scheduler marker, clears checkpoint and marker together, advances timestamps without moving maintenance time backward, and forces statement rollback if the two guarded updates do not both affect one row.
```

Run:

```powershell
pnpm.cmd docs:check
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --check -- src/data/repositories/channel-maintenance-repository.ts tests/integration/jobs/channel-maintenance-adversarial.test.ts docs/reference/simple/src/data/repositories/channel-maintenance-repository.md docs/reference/technical/src/data/repositories/channel-maintenance-repository.md
```

Expected: documentation coverage and whitespace checks pass.

- [ ] **Step 9: Commit the repository slice with exact staging**

```powershell
$task1Paths = @(
  'src/data/repositories/channel-maintenance-repository.ts',
  'tests/integration/jobs/channel-maintenance-adversarial.test.ts',
  'tests/contract/google/oauth.contract.test.ts',
  'docs/reference/simple/src/data/repositories/channel-maintenance-repository.md',
  'docs/reference/technical/src/data/repositories/channel-maintenance-repository.md'
)
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" add -- $task1Paths
$unexpected = @(git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --name-only | Where-Object { $_ -notin $task1Paths })
if ($unexpected.Count -ne 0) { throw 'Task 1 exact staging mismatch' }
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --check
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" commit -m "feat: recover scheduler authorization after reconnect"
```

Expected: one commit containing exactly the five Task 1 paths; setback and credential ledgers remain unstaged.

---

### Task 2: Real PostgreSQL Interleaving and Rollback Proof

**Files:**

- Create: `tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts`

**Interfaces:**

- Consumes: `createChannelMaintenanceRepository(database, ownerId)` and `recoverAuthorizationAfterReconnect(input)` from Task 1.
- Produces: one opt-in real-PostgreSQL suite gated by the existing approved disposable-database controls `VISION_SYNC_CONCURRENCY_TEST_APPROVED=true` and `VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL`; no new product or test environment name is added.

- [ ] **Step 1: Create the disposable-schema test harness**

Create the file with these imports, guards, and helpers:

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
import { SyncCalendarError } from "../../../src/jobs/sync-calendar";

const DATABASE_URL_ENV = "VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL";
const APPROVAL_ENV = "VISION_SYNC_CONCURRENCY_TEST_APPROVED";
const OWNER = "owner_auth_reconnect_race";
const SUBJECT = "subject_auth_reconnect_race";
const CALENDAR = "calendar_auth_reconnect_race";
const FAILURE_AT = new Date("2026-08-02T05:00:00.000Z");
const TOKEN_AT = new Date("2026-08-02T05:00:01.000Z");
const dialect = new PgDialect();
const migrations = [
  "0001_phase_b_foundation.sql",
  "0002_google_auth_sessions.sql",
  "0003_calendar_setup.sql",
  "0004_incremental_event_sync.sql",
  "0005_google_notification_jobs.sql",
  "0006_google_channel_lifecycle.sql",
  "0007_calendar_maintenance_state.sql",
  "0008_google_projection_rebuild.sql",
  "0009_ai_usage_budget.sql",
] as const;

const configuredDatabaseUrl = process.env[DATABASE_URL_ENV];
const approved = process.env[APPROVAL_ENV] === "true";
if (approved && (!configuredDatabaseUrl || configuredDatabaseUrl.length === 0)) {
  throw new Error("Approved reconnect concurrency database is unavailable.");
}
const approvedDatabaseUrl = approved ? configuredDatabaseUrl : undefined;
const liveIt = approvedDatabaseUrl === undefined ? it.skip : it;

function sessionDatabase(client: PoolClient): VisionDatabase {
  return {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await client.query(query.sql, query.params as unknown[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
}

function quoteTestSchema(schema: string): string {
  if (!/^vision_auth_reconnect_[a-z0-9_]+$/u.test(schema)) {
    throw new Error("Invalid reconnect race-test schema.");
  }
  return `"${schema}"`;
}

async function waitForLock(observer: PoolClient, applicationName: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await observer.query<{
      wait_event_type: string | null;
    }>(
      `select wait_event_type
       from pg_stat_activity
       where application_name = $1 and state = 'active'`,
      [applicationName],
    );
    if (result.rows.some((row) => row.wait_event_type === "Lock")) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error("Expected reconnect PostgreSQL lock wait was not observed.");
}

async function seedLiveShape(admin: PoolClient): Promise<void> {
  await admin.query(
    `insert into calendar_setup_states (
       owner_id, google_subject, setup_version, status, action_required, updated_at
     ) values ($1, $2, 4, 'connected', false, $3)`,
    [OWNER, SUBJECT, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into vision_calendar_connections (
       owner_id, google_subject, provider_calendar_id, summary,
       ownership_access_role, time_zone, provider_etag, verified_at,
       connection_kind
     ) values ($1, $2, $3, 'Vision', 'owner', 'America/Chicago',
       'etag-safe', $4, 'existing')`,
    [OWNER, SUBJECT, CALENDAR, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into sync_checkpoints (
       id, owner_id, provider, provider_calendar_id, sync_token_envelope,
       key_version, committed_at, version, status, last_error_category, updated_at
     ) values (
       'checkpoint_auth_reconnect', $1, 'google-calendar', $2, $3, 1,
       $4, 1, 'disconnected', 'authorization', $4
     )`,
    [OWNER, CALENDAR, new Uint8Array([1]), FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into calendar_sync_maintenance (
       owner_id, provider, provider_calendar_id, connection_version,
       checkpoint_version, renewal_generation, renewal_failures,
       credential_failure_checkpoint_version, credential_failure_category,
       credential_failure_recorded_at, created_at, updated_at
     ) values (
       $1, 'google-calendar', $2, 4, 1, 3, 2,
       1, 'authorization', $3, $3, $3
     )`,
    [OWNER, CALENDAR, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into google_oauth_tokens (
       owner_id, google_subject, refresh_token_envelope,
       refresh_token_digest, access_token_envelope, access_expires_at,
       granted_scopes, token_version, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, 2, $8)`,
    [
      OWNER,
      SUBJECT,
      new Uint8Array([2]),
      "R".repeat(43),
      new Uint8Array([3]),
      new Date(TOKEN_AT.getTime() + 3_600_000).toISOString(),
      "https://www.googleapis.com/auth/calendar.readonly",
      TOKEN_AT.toISOString(),
    ],
  );
}
```

- [ ] **Step 2: Add the disposable-schema runner, four interleavings, and partial-update failpoint**

Append this complete runner and test body after `seedLiveShape()`:

```ts
interface RaceContext {
  readonly admin: PoolClient;
  readonly writer: PoolClient;
  readonly recovery: PoolClient;
  readonly follower: PoolClient;
  readonly observer: PoolClient;
  readonly recoveryApplication: string;
  readonly followerApplication: string;
  readonly advisoryKey: number;
}

async function withRaceSchema(
  run: (context: RaceContext) => Promise<void>,
): Promise<void> {
  if (!approvedDatabaseUrl) {
    throw new Error("Reconnect concurrency database was not approved.");
  }
  const pool = new Pool({ connectionString: approvedDatabaseUrl, max: 5 });
  const admin = await pool.connect();
  const writer = await pool.connect();
  const recovery = await pool.connect();
  const follower = await pool.connect();
  const observer = await pool.connect();
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const schema = `vision_auth_reconnect_${suffix}`;
  const quotedSchema = quoteTestSchema(schema);
  const recoveryApplication = `vision_auth_recovery_${suffix.slice(0, 12)}`;
  const followerApplication = `vision_auth_follower_${suffix.slice(0, 12)}`;
  const advisoryKey = Number.parseInt(suffix.slice(0, 7), 16);
  try {
    await admin.query(`create schema ${quotedSchema}`);
    await admin.query(`set search_path to ${quotedSchema}, public`);
    for (const migration of migrations) {
      await admin.query(
        await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
      );
    }
    for (const client of [writer, recovery, follower, observer]) {
      await client.query(`set search_path to ${quotedSchema}, public`);
      await client.query(`set statement_timeout to '15s'`);
    }
    await recovery.query(`select set_config('application_name', $1, false)`, [
      recoveryApplication,
    ]);
    await follower.query(`select set_config('application_name', $1, false)`, [
      followerApplication,
    ]);
    await seedLiveShape(admin);
    await run({
      admin,
      writer,
      recovery,
      follower,
      observer,
      recoveryApplication,
      followerApplication,
      advisoryKey,
    });
  } finally {
    await Promise.allSettled([
      writer.query("rollback"),
      recovery.query("rollback"),
      follower.query("rollback"),
    ]);
    await admin.query(`drop schema if exists ${quotedSchema} cascade`);
    observer.release();
    follower.release();
    recovery.release();
    writer.release();
    admin.release();
    await pool.end();
  }
}

async function readClosedState(client: PoolClient): Promise<Record<string, unknown>> {
  const result = await client.query(
    `select
       token.token_version,
       checkpoint.status,
       checkpoint.last_error_category,
       checkpoint.updated_at,
       maintenance.credential_failure_checkpoint_version,
       maintenance.credential_failure_category,
       maintenance.credential_failure_recorded_at
     from google_oauth_tokens as token
     inner join sync_checkpoints as checkpoint
       on checkpoint.owner_id = token.owner_id
     inner join calendar_sync_maintenance as maintenance
       on maintenance.owner_id = checkpoint.owner_id
      and maintenance.provider = checkpoint.provider
      and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
     where token.owner_id = $1`,
    [OWNER],
  );
  if (result.rows.length !== 1) {
    throw new Error("Reconnect race fixture lost its exact state row.");
  }
  return result.rows[0] as Record<string, unknown>;
}

describe("OAuth reconnect recovery on multi-session PostgreSQL", () => {
  liveIt(
    "fails an older callback after a newer token write wins",
    async () => {
      await withRaceSchema(async ({
        writer,
        recovery,
        observer,
        recoveryApplication,
      }) => {
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await writer.query("begin");
        await writer.query(
          `update google_oauth_tokens
           set token_version = 3, updated_at = $1
           where owner_id = $2`,
          [new Date(TOKEN_AT.getTime() + 1_000).toISOString(), OWNER],
        );
        const recoveryPromise = repository.recoverAuthorizationAfterReconnect({
          googleSubject: SUBJECT,
          tokenVersion: 2,
          tokenUpdatedAt: TOKEN_AT,
        });
        await waitForLock(observer, recoveryApplication);
        await writer.query("commit");
        await expect(recoveryPromise).resolves.toBe("conflict");
        await expect(readClosedState(observer)).resolves.toMatchObject({
          token_version: 3,
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: FAILURE_AT,
        });
      });
    },
    60_000,
  );

  liveIt(
    "preserves a scheduler failure that commits before recovery",
    async () => {
      await withRaceSchema(async ({
        admin,
        writer,
        recovery,
        observer,
        recoveryApplication,
      }) => {
        await admin.query(
          `update sync_checkpoints
           set status = 'connected', last_error_category = null, updated_at = $1
           where owner_id = $2`,
          [FAILURE_AT.toISOString(), OWNER],
        );
        await admin.query(
          `update calendar_sync_maintenance
           set credential_failure_checkpoint_version = null,
               credential_failure_category = null,
               credential_failure_recorded_at = null
           where owner_id = $1`,
          [OWNER],
        );
        const schedulerRepository = createChannelMaintenanceRepository(
          sessionDatabase(writer),
          OWNER,
        );
        const recoveryRepository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        const newerFailureAt = new Date(TOKEN_AT.getTime() + 1_000);
        await writer.query("begin");
        await expect(
          schedulerRepository.recordCredentialFailure(
            new SyncCalendarError("authorization", "disconnected", false),
            newerFailureAt,
          ),
        ).resolves.toBe(true);
        const recoveryPromise =
          recoveryRepository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          });
        await waitForLock(observer, recoveryApplication);
        await writer.query("commit");
        await expect(recoveryPromise).resolves.toBe("conflict");
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: newerFailureAt,
        });
      });
    },
    60_000,
  );

  liveIt(
    "keeps a new scheduler failure written after successful recovery",
    async () => {
      await withRaceSchema(async ({ recovery, observer }) => {
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await expect(
          repository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          }),
        ).resolves.toBe("recovered");
        const newerFailureAt = new Date(TOKEN_AT.getTime() + 1_000);
        await expect(
          repository.recordCredentialFailure(
            new SyncCalendarError("authorization", "disconnected", false),
            newerFailureAt,
          ),
        ).resolves.toBe(true);
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: newerFailureAt,
        });
      });
    },
    60_000,
  );

  liveIt(
    "serializes two callbacks without a partial clear",
    async () => {
      await withRaceSchema(async ({
        admin,
        writer,
        recovery,
        follower,
        observer,
        recoveryApplication,
        followerApplication,
        advisoryKey,
      }) => {
        await admin.query(`
          create function pause_reconnect_checkpoint() returns trigger
          language plpgsql as $$
          begin
            perform pg_advisory_xact_lock(${advisoryKey});
            return new;
          end
          $$;
          create trigger pause_reconnect_checkpoint
          before update on sync_checkpoints
          for each row execute function pause_reconnect_checkpoint();
        `);
        const firstRepository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        const followerRepository = createChannelMaintenanceRepository(
          sessionDatabase(follower),
          OWNER,
        );
        const input = {
          googleSubject: SUBJECT,
          tokenVersion: 2,
          tokenUpdatedAt: TOKEN_AT,
        } as const;
        let first: Promise<"recovered" | "not_needed" | "conflict"> | undefined;
        let second: Promise<"recovered" | "not_needed" | "conflict"> | undefined;
        let advisoryHeld = false;
        try {
          await writer.query(`select pg_advisory_lock($1)`, [advisoryKey]);
          advisoryHeld = true;
          first = firstRepository.recoverAuthorizationAfterReconnect(input);
          await waitForLock(observer, recoveryApplication);
          second = followerRepository.recoverAuthorizationAfterReconnect(input);
          await waitForLock(observer, followerApplication);
          await writer.query(`select pg_advisory_unlock($1)`, [advisoryKey]);
          advisoryHeld = false;
          const outcomes = await Promise.all([first, second]);
          expect([...outcomes].sort()).toEqual(["not_needed", "recovered"]);
          await expect(readClosedState(observer)).resolves.toMatchObject({
            status: "connected",
            last_error_category: null,
            credential_failure_checkpoint_version: null,
            credential_failure_category: null,
            credential_failure_recorded_at: null,
          });
        } finally {
          if (advisoryHeld) {
            await writer.query(`select pg_advisory_unlock($1)`, [advisoryKey]);
          }
          await Promise.allSettled(
            [first, second].filter(
              (promise): promise is Promise<"recovered" | "not_needed" | "conflict"> =>
                promise !== undefined,
            ),
          );
        }
      });
    },
    60_000,
  );

  liveIt(
    "rolls back the checkpoint when maintenance clear is suppressed",
    async () => {
      await withRaceSchema(async ({ admin, recovery, observer }) => {
        await admin.query(`
          create function suppress_marker_clear() returns trigger
          language plpgsql as $$
          begin
            if old.credential_failure_checkpoint_version is not null
               and new.credential_failure_checkpoint_version is null then
              return null;
            end if;
            return new;
          end
          $$;
          create trigger suppress_marker_clear
          before update on calendar_sync_maintenance
          for each row execute function suppress_marker_clear();
        `);
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await expect(
          repository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          }),
        ).rejects.toThrow();
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: FAILURE_AT,
        });
      });
    },
    60_000,
  );
});
```

The test inspects only its generated schema and fixed synthetic identifiers. It never prints the connection string or a private row.

- [ ] **Step 3: Run the real PostgreSQL suite against the approved disposable database**

Precondition: `VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL` is already supplied out of band for the explicitly approved disposable target. Do not echo it.

Run:

```powershell
if ([string]::IsNullOrWhiteSpace($env:VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL)) {
  throw 'Approved disposable reconnect test database is unavailable'
}
$env:VISION_SYNC_CONCURRENCY_TEST_APPROVED = 'true'
try {
  .\node_modules\.bin\vitest.cmd run tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts --project unit --reporter verbose
} finally {
  Remove-Item Env:VISION_SYNC_CONCURRENCY_TEST_APPROVED -ErrorAction SilentlyContinue
}
```

Expected: all five named tests pass, none are skipped, every generated schema is removed in `finally`, and the command prints no database URL.

- [ ] **Step 4: Run the non-approved gate and typecheck**

```powershell
Remove-Item Env:VISION_SYNC_CONCURRENCY_TEST_APPROVED -ErrorAction SilentlyContinue
.\node_modules\.bin\vitest.cmd run tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts --project unit --reporter verbose
pnpm.cmd typecheck
```

Expected: the five network-backed tests are explicitly skipped without opening a database connection, and typecheck reports zero diagnostics.

- [ ] **Step 5: Commit the concurrency proof**

```powershell
$task2Paths = @('tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts')
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" add -- $task2Paths
$unexpected = @(git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --name-only | Where-Object { $_ -notin $task2Paths })
if ($unexpected.Count -ne 0) { throw 'Task 2 exact staging mismatch' }
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --check
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" commit -m "test: prove reconnect recovery interleavings"
```

Expected: one commit containing only the new opt-in concurrency test.

---

### Task 3: OAuth Callback Port, Ordering, and Safe Failure

**Files:**

- Modify: `tests/worker/auth.test.ts`
- Modify: `src/server/auth/oauth-routes.ts`
- Modify: `docs/reference/simple/src/server/auth/oauth-routes.md`
- Modify: `docs/reference/technical/src/server/auth/oauth-routes.md`

**Interfaces:**

- Consumes: `AuthorizationRecoveryOutcome` and `createChannelMaintenanceRepository()` from Task 1; `RetainedGoogleTokens.tokenVersion` and `.updatedAt` already returned by `saveGoogleTokens()`.
- Produces:

  ```ts
  export interface AuthorizationRecoveryPort {
    recoverAfterReconnect(input: {
      readonly googleSubject: string;
      readonly tokenVersion: number;
      readonly tokenUpdatedAt: Date;
    }): Promise<AuthorizationRecoveryOutcome>;
  }

  AuthRouteDependencies["authorizationRecovery"]: AuthorizationRecoveryPort;
  ```

- [ ] **Step 1: Make the Worker harness inject a deterministic recovery port**

Import the port type:

```ts
import type { AuthorizationRecoveryPort } from "../../src/server/auth/oauth-routes";
import { IdentityAuthorizationError } from "../../src/domain/auth/identity";
```

Add `authorizationRecovery?: AuthorizationRecoveryPort;` as the first property
of the existing `createHarness` option type. Immediately after constructing
`tokens`, insert:

```ts
const authorizationRecovery = options.authorizationRecovery ?? {
  recoverAfterReconnect: vi.fn(async () => "not_needed" as const),
};
```

Insert `authorizationRecovery,` immediately after `admissionKey` in the
existing `auth` dependency object. Insert the same property immediately after
`app,` in the existing returned object. No existing dependency or return
property is removed.

- [ ] **Step 2: Write RED ordering and successful-outcome tests**

Add a table-driven success test for both closed continuing outcomes, and an ordering test with an existing session:

```ts
it.each(["recovered", "not_needed"] as const)(
  "continues secure callback after authorization recovery returns %s",
  async (outcome) => {
    const authorizationRecovery: AuthorizationRecoveryPort = {
      recoverAfterReconnect: vi.fn(async () => outcome),
    };
    const { app, sessionStore } = await createHarness({ authorizationRecovery });
    await app.fetch(new Request("https://vision.example.test/api/auth/google/start"), {} as Env);
    const response = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );
    expect(response.status).toBe(302);
    expect(sessionStore.sessionRows).toHaveLength(1);
    expect(authorizationRecovery.recoverAfterReconnect).toHaveBeenCalledWith({
      googleSubject: "google-subject",
      tokenVersion: 1,
      tokenUpdatedAt: now,
    });
    expect(
      Object.keys(
        vi.mocked(authorizationRecovery.recoverAfterReconnect).mock.calls[0]![0],
      ).sort(),
    ).toEqual(["googleSubject", "tokenUpdatedAt", "tokenVersion"]);
  },
);

it("runs recovery after token persistence and before session rotation or creation", async () => {
  const recovery = vi.fn(async () => "recovered" as const);
  const { app, sessions, tokens } = await createHarness({
    authorizationRecovery: { recoverAfterReconnect: recovery },
  });
  const save = vi.spyOn(tokens, "saveGoogleTokens");
  const revoke = vi.spyOn(sessions, "revokeSession");
  const create = vi.spyOn(sessions, "createSession");
  const oldSessionId = "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO";
  await sessions.createSession({
    sessionId: oldSessionId,
    ownerId: "usr_private_pilot",
    googleSubject: "google-subject",
    email: "allowed@example.test",
    csrfToken: "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
  });
  create.mockClear();
  await app.fetch(new Request("https://vision.example.test/api/auth/google/start"), {} as Env);
  await app.fetch(
    new Request(
      `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      { headers: { cookie: `vision_session=${oldSessionId}` } },
    ),
    {} as Env,
  );
  expect(save.mock.invocationCallOrder[0]).toBeLessThan(recovery.mock.invocationCallOrder[0]!);
  expect(recovery.mock.invocationCallOrder[0]).toBeLessThan(revoke.mock.invocationCallOrder[0]!);
  expect(revoke.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]!);
});
```

- [ ] **Step 3: Write RED conflict, throw, durability, and privacy tests**

```ts
it.each([
  ["conflict", { recoverAfterReconnect: vi.fn(async () => "conflict" as const) }],
  ["throw", { recoverAfterReconnect: vi.fn(async () => {
    throw new Error("RECOVERY_DATABASE_DETAIL_SENTINEL");
  }) }],
  ["identity-shaped throw", { recoverAfterReconnect: vi.fn(async () => {
    throw new IdentityAuthorizationError();
  }) }],
] as const)("fails safely when reconnect recovery returns %s", async (_case, authorizationRecovery) => {
  const { app, logger, sessionStore, sessions, tokenStore } = await createHarness({
    authorizationRecovery,
  });
  const oldSessionId = "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO";
  await sessions.createSession({
    sessionId: oldSessionId,
    ownerId: "usr_private_pilot",
    googleSubject: "google-subject",
    email: "allowed@example.test",
    csrfToken: "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
  });
  await app.fetch(new Request("https://vision.example.test/api/auth/google/start"), {} as Env);
  const response = await app.fetch(
    new Request(
      `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      { headers: { cookie: `vision_session=${oldSessionId}` } },
    ),
    {} as Env,
  );
  expect(response.status).toBe(400);
  expect(await response.text()).toBe(
    "<!doctype html><html><body><h1>Authentication failed</h1><p>Please try again.</p></body></html>",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(tokenStore.rows).toHaveLength(1);
  expect(sessionStore.sessionRows).toHaveLength(1);
  expect(sessionStore.sessionRows[0]?.revokedAt).toBeNull();
  expect(logger).toHaveBeenCalledWith(expect.objectContaining({
    action: "auth.callback",
    errorCategory: "authorization_recovery_failed",
    outcome: "failed",
  }));
  const observable = JSON.stringify({
    body: "Authentication failed. Please try again.",
    logs: logger.mock.calls,
  });
  for (const forbidden of [
    "RECOVERY_DATABASE_DETAIL_SENTINEL",
    "REFRESH_TOKEN_SENTINEL",
    "ACCESS_TOKEN_SENTINEL",
    "google-subject",
    "allowed@example.test",
  ]) {
    expect(observable).not.toContain(forbidden);
  }
});
```

The existing successful callback test, with the default `not_needed` port and no calendar setup, remains the explicit first-login proof.

- [ ] **Step 4: Run the Worker tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run tests/worker/auth.test.ts --project worker
```

Expected: new tests fail because `authorizationRecovery` is not yet part of `AuthRouteDependencies` and the callback never invokes it; existing auth behavior remains otherwise unchanged.

- [ ] **Step 5: Add the port, safe category, callback order, and production wiring**

In `oauth-routes.ts`, import the repository contract and factory:

```ts
import {
  createChannelMaintenanceRepository,
  type AuthorizationRecoveryOutcome,
} from "../../data/repositories/channel-maintenance-repository";
```

Add the port before `AuthRouteDependencies`:

```ts
/** Narrow owner-scoped synchronization repair boundary used only after reconnect. */
export interface AuthorizationRecoveryPort {
  recoverAfterReconnect(input: {
    readonly googleSubject: string;
    readonly tokenVersion: number;
    readonly tokenUpdatedAt: Date;
  }): Promise<AuthorizationRecoveryOutcome>;
}
```

Insert this property immediately after `admissionKey` in the existing
`AuthRouteDependencies` interface:

```ts
readonly authorizationRecovery: AuthorizationRecoveryPort;
```

Add `"authorization_recovery_failed"` immediately after `"token_persistence_failed"` in `AuthCallbackFailureCategory`. Replace the callback token write with:

```ts
failureCategory = "token_persistence_failed";
const issuedAt = dependencies.now();
const retainedTokens = await dependencies.tokens.saveGoogleTokens({
  googleSubject: identity.subject,
  ...(tokenSet.refreshToken ? { refreshToken: tokenSet.refreshToken } : {}),
  accessToken: tokenSet.accessToken,
  accessExpiresAt: new Date(
    issuedAt.getTime() + tokenSet.expiresInSeconds * 1_000,
  ),
  grantedScopes: tokenSet.scopes,
  updatedAt: issuedAt,
});

failureCategory = "authorization_recovery_failed";
const recoveryOutcome =
  await dependencies.authorizationRecovery.recoverAfterReconnect({
    googleSubject: identity.subject,
    tokenVersion: retainedTokens.tokenVersion,
    tokenUpdatedAt: retainedTokens.updatedAt,
  });
if (
  recoveryOutcome !== "recovered" &&
  recoveryOutcome !== "not_needed"
) {
  throw new Error("Authorization recovery did not admit session creation.");
}

failureCategory = "session_rotation_failed";
```

Tighten the existing allowlist-denial catch so only an error thrown while the
callback is still in the claims stage can become `account_not_allowed`:

```ts
if (
  dependencies !== undefined &&
  failureCategory === "claims_validation_failed" &&
  error instanceof IdentityAuthorizationError
) {
```

In `createProductionAuthDependencies()`, construct one repository adapter
immediately after deriving `ownerId`:

```ts
const ownerId = await deriveOwnerId(authEnvironment.GOOGLE_ALLOWED_SUB);
const maintenance = createChannelMaintenanceRepository(
  database,
  ownerId,
);
const authorizationRecovery: AuthorizationRecoveryPort = {
  /** Delegates the narrow callback port to the owner-scoped repository method. */
  recoverAfterReconnect: (input) =>
    maintenance.recoverAuthorizationAfterReconnect(input),
};
```

Insert `authorizationRecovery,` immediately after `admissionKey,` in the
existing production return object. No existing production dependency is
removed.

- [ ] **Step 6: Run focused Worker and repository verification**

```powershell
.\node_modules\.bin\vitest.cmd run tests/worker/auth.test.ts --project worker
.\node_modules\.bin\vitest.cmd run tests/integration/jobs/channel-maintenance-adversarial.test.ts --project unit
pnpm.cmd typecheck
```

Expected: both focused files pass and typecheck reports zero diagnostics.

- [ ] **Step 7: Update both OAuth references and run documentation coverage**

In the simple reference, change the callback summary to include guarded recovery and add:

```md
## `recoverAfterReconnect`
Checks whether Vision may safely clear an older scheduler-owned authorization disconnect after encrypted credentials are saved.
```

In the technical reference, update callback side effects to state `token persistence -> guarded recovery -> session rotation -> session creation`, then add:

```md
## `recoverAfterReconnect`
Receives only the verified subject and authoritative token version/update time returned by token persistence. `recovered` and `not_needed` continue; `conflict`, an unknown result, or an exception maps to `authorization_recovery_failed` before any old session is revoked or new session is created.
```

Because the documentation validator checks named functions and methods rather than interface methods, run it and retain only headings it actually requires:

```powershell
pnpm.cmd docs:check
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --check -- src/server/auth/oauth-routes.ts tests/worker/auth.test.ts docs/reference/simple/src/server/auth/oauth-routes.md docs/reference/technical/src/server/auth/oauth-routes.md
```

Expected: documentation coverage and whitespace checks pass.

- [ ] **Step 8: Commit the callback slice with exact staging**

```powershell
$task3Paths = @(
  'src/server/auth/oauth-routes.ts',
  'tests/worker/auth.test.ts',
  'docs/reference/simple/src/server/auth/oauth-routes.md',
  'docs/reference/technical/src/server/auth/oauth-routes.md'
)
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" add -- $task3Paths
$unexpected = @(git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --name-only | Where-Object { $_ -notin $task3Paths })
if ($unexpected.Count -ne 0) { throw 'Task 3 exact staging mismatch' }
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --check
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" commit -m "feat: reconcile authorization before session creation"
```

Expected: one commit containing exactly the four Task 3 paths; ledgers remain unstaged.

---

### Task 4: Full Verification, Independent Review, and Candidate Freeze

**Files:**

- Inspect: every Task 1-3 changed path and the complete branch diff from the previously reviewed parent.
- Modify only when a failing test or review finding proves a specific defect; keep each correction inside the Task 1-3 file allowlist.

**Interfaces:**

- Consumes: the complete repository, callback, concurrency, and documentation slices.
- Produces: one exact candidate commit with zero failing gates, zero Critical findings, and zero Important findings.

- [ ] **Step 1: Run all focused recovery tests**

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/jobs/channel-maintenance-adversarial.test.ts tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts --project unit
.\node_modules\.bin\vitest.cmd run tests/worker/auth.test.ts --project worker
```

Expected: PGlite and Worker recovery tests pass; the opt-in real-PostgreSQL cases are skipped only in this non-approved local invocation.

- [ ] **Step 2: Re-run the approved real-PostgreSQL proof**

Use the exact Task 2 approved command. Expected: five passed and zero skipped, with every generated schema removed.

- [ ] **Step 3: Run the full local release gate**

```powershell
pnpm.cmd run ci
pnpm.cmd deploy:check:preview
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --check
```

Expected: typecheck, unit/integration, contract, Worker, documentation, build, crypto-boundary, security evidence/scan, browser smoke, preview configuration, and whitespace gates all pass.

- [ ] **Step 4: Audit the exact diff for scope and privacy**

```powershell
$allowed = @(
  'src/data/repositories/channel-maintenance-repository.ts',
  'src/server/auth/oauth-routes.ts',
  'tests/integration/jobs/channel-maintenance-adversarial.test.ts',
  'tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts',
  'tests/contract/google/oauth.contract.test.ts',
  'tests/worker/auth.test.ts',
  'docs/reference/simple/src/data/repositories/channel-maintenance-repository.md',
  'docs/reference/technical/src/data/repositories/channel-maintenance-repository.md',
  'docs/reference/simple/src/server/auth/oauth-routes.md',
  'docs/reference/technical/src/server/auth/oauth-routes.md'
)
$changed = @(git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --name-only "$implementationBase..HEAD")
$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -ne 0) { throw 'Reconnect repair changed an unapproved path' }
pnpm.cmd security:scan
```

Expected: only the ten implementation paths are in the repair diff and the release privacy/security scan passes. The owner-reviewed specification and implementation plan remain outside `$implementationBase..HEAD`.

- [ ] **Step 5: Obtain independent two-stage review**

Dispatch one subagent at a time. First ask for specification compliance against `docs/superpowers/specs/2026-08-02-oauth-reconnect-authorization-recovery-design.md`; then, after resolving any proven gap, ask a fresh reviewer for code quality, SQL atomicity, concurrency, privacy, and test-quality findings. Require both reviewers to inspect the exact commit, not a moving worktree.

Expected: zero Critical and zero Important findings. For any proven finding, add a focused failing regression test, implement the smallest correction, re-run the affected focused tests plus `pnpm.cmd run ci`, commit the correction, and repeat both reviews on the new exact commit.

- [ ] **Step 6: Freeze exact candidate evidence without staging ledgers**

```powershell
$candidate = git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" rev-parse HEAD
if ($candidate -notmatch '^[a-f0-9]{40}$') { throw 'Candidate commit is not canonical' }
$implementationPaths = @(
  'src/data/repositories/channel-maintenance-repository.ts',
  'src/server/auth/oauth-routes.ts',
  'tests/integration/jobs/channel-maintenance-adversarial.test.ts',
  'tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts',
  'tests/contract/google/oauth.contract.test.ts',
  'tests/worker/auth.test.ts',
  'docs/reference/simple/src/data/repositories/channel-maintenance-repository.md',
  'docs/reference/technical/src/data/repositories/channel-maintenance-repository.md',
  'docs/reference/simple/src/server/auth/oauth-routes.md',
  'docs/reference/technical/src/server/auth/oauth-routes.md'
)
$implementationResidue = @(
  git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" status --porcelain=v1 -- $implementationPaths
)
if ($implementationResidue.Count -ne 0) {
  throw 'Candidate freeze found staged, unstaged, or untracked implementation residue'
}
$staged = @(git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" diff --cached --name-only)
if ($staged.Count -ne 0) { throw 'Candidate freeze found staged residue' }
```

Expected: one canonical commit is captured only in ignored local evidence; all ten implementation paths are clean; no tracked ledger is staged. Intentionally dirty planning, setback, and credential-ledger paths are outside the implementation-path check and remain unstaged.

---

### Task 5: Exact Push, Preview Deployment, and Live Reconnect Verification

**Files:**

- Append safe facts only: `.superpowers/sdd/task-8-evidence.md` (ignored local evidence)
- Update but do not stage: `docs/operations/setbacks/incidents/2026-08-02T053226Z-task8-reconnect-stale-authorization-checkpoint.md`
- Resume after success: `docs/superpowers/plans/2026-07-29-phase-b-live-acceptance-closure.md` Task 8 Step 1

**Interfaces:**

- Consumes: exact reviewed candidate, the previous reviewed normal application tree at `$implementationBase`, permanent normal preview configuration, existing Cloudflare/Neon/Google resources, and owner interaction only when Google displays account/consent controls.
- Produces: privacy-safe proof of authenticated reconnect, connected foundation health, absent stale marker, normal schedules/bindings, and a resumed authoritative Task 8 sequence.

- [ ] **Step 1: Push only the reviewed exact commit**

Use `$remoteParent` captured and remotely verified before Task 1 and `$candidate` from Task 4. Run the permanent privacy-safe adapter:

```powershell
.\node_modules\.bin\tsx.cmd scripts/privacy-safe-git-remote.ts push_exact --branch codex/phase-b-foundation --expected-parent $remoteParent --expected-commit $candidate
```

Expected sole stdout: `True`. Any other result stops deployment; do not use a raw remote Git command as fallback.

- [ ] **Step 2: Build and verify isolated candidate and previous-normal rollback artifacts**

```powershell
$artifactParent = [IO.Path]::GetFullPath(
  (Join-Path (Get-Location) '.superpowers\sdd')
)
$candidateWorktree = [IO.Path]::GetFullPath(
  (Join-Path $artifactParent 'oauth-reconnect-candidate-worktree')
)
$rollbackWorktree = [IO.Path]::GetFullPath(
  (Join-Path $artifactParent 'oauth-reconnect-rollback-worktree')
)
if (
  -not $candidateWorktree.StartsWith($artifactParent, [StringComparison]::OrdinalIgnoreCase) -or
  -not $rollbackWorktree.StartsWith($artifactParent, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'Artifact worktree escaped its exact ignored parent'
}
if (
  (Test-Path -LiteralPath $candidateWorktree) -or
  (Test-Path -LiteralPath $rollbackWorktree)
) {
  throw 'Candidate or rollback worktree target already exists'
}
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" worktree add --detach -- $candidateWorktree $candidate
if ($LASTEXITCODE -ne 0) {
  throw 'Exact candidate worktree creation failed'
}
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" worktree add --detach -- $rollbackWorktree $implementationBase
if ($LASTEXITCODE -ne 0) {
  throw 'Exact rollback worktree creation failed'
}
Push-Location -LiteralPath $candidateWorktree
try {
  $isolatedCandidate = git rev-parse HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'Exact candidate identity read failed'
  }
  if ($isolatedCandidate -ne $candidate) {
    throw 'Isolated candidate worktree does not match the reviewed commit'
  }
  pnpm.cmd install --offline --frozen-lockfile
  if ($LASTEXITCODE -ne 0) {
    throw 'Exact candidate dependency installation failed'
  }
  if ([string]::IsNullOrWhiteSpace($env:VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL)) {
    throw 'Approved disposable reconnect test database is unavailable'
  }
  $env:VISION_SYNC_CONCURRENCY_TEST_APPROVED = 'true'
  try {
    .\node_modules\.bin\vitest.cmd run tests/integration/jobs/oauth-reconnect-postgresql-concurrency.test.ts --project unit --reporter verbose
    $postgresProofExit = $LASTEXITCODE
  } finally {
    Remove-Item Env:VISION_SYNC_CONCURRENCY_TEST_APPROVED -ErrorAction SilentlyContinue
  }
  if ($postgresProofExit -ne 0) {
    throw 'Exact candidate real-PostgreSQL proof failed'
  }
  pnpm.cmd run ci
  if ($LASTEXITCODE -ne 0) {
    throw 'Exact candidate release gate failed'
  }
  pnpm.cmd deploy:check:preview
  if ($LASTEXITCODE -ne 0) {
    throw 'Exact candidate preview deployment check failed'
  }
} finally {
  Pop-Location
}
Push-Location -LiteralPath $rollbackWorktree
try {
  $isolatedRollback = git rev-parse HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'Previous-normal rollback identity read failed'
  }
  if ($isolatedRollback -ne $implementationBase) {
    throw 'Isolated rollback worktree does not match the previous reviewed normal commit'
  }
  pnpm.cmd install --offline --frozen-lockfile
  if ($LASTEXITCODE -ne 0) {
    throw 'Previous-normal rollback dependency installation failed'
  }
  pnpm.cmd build
  if ($LASTEXITCODE -ne 0) {
    throw 'Previous-normal rollback build failed'
  }
  pnpm.cmd deploy:check:preview
  if ($LASTEXITCODE -ne 0) {
    throw 'Previous-normal rollback preview deployment check failed'
  }
} finally {
  Pop-Location
}
```

Expected: the real-PostgreSQL proof, full release gate, production build, crypto-boundary check, and preview binding validation pass from the detached worktree whose `HEAD` is exactly `$candidate`; build and preview validation also pass for the detached previous-normal rollback worktree. The dirty planning worktree is never an artifact source. Keep both exact ignored worktrees until candidate acceptance or verified rollback closes.

- [ ] **Step 3: Deploy from the isolated exact reviewed candidate**

From only the retained detached candidate worktree, re-assert `HEAD` and use its generated normal configuration:

```powershell
$candidateWorktree = [IO.Path]::GetFullPath(
  (Join-Path (Get-Location) '.superpowers\sdd\oauth-reconnect-candidate-worktree')
)
Push-Location -LiteralPath $candidateWorktree
try {
  $deployHead = git rev-parse HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'Candidate artifact identity read failed before deploy'
  }
  if ($deployHead -ne $candidate) {
    throw 'Candidate artifact moved after isolated verification'
  }
  & .\node_modules\.bin\wrangler.cmd deploy --config dist/vision/wrangler.json --name vision-preview *> $null
  $candidateDeployExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($candidateDeployExit -ne 0) {
  throw 'Candidate deploy failed or became uncertain; execute Task 5 Step 4 immediately'
}
'deployed=true'
```

Expected sole local fact: `deployed=true`. Do not retain raw provider output. Do not pass new variables, add bindings, create schedules, configure AI, rotate a key, or deploy an acceptance/fault artifact. A nonzero or interrupted command is uncertain even if Cloudflare may have accepted part of it; execute Step 4 before any retry or owner interaction.

- [ ] **Step 4: Roll back any failed or uncertain candidate deployment**

This is a conditional safety step. Run it immediately when Step 3 is nonzero or interrupted, when deployment attribution cannot be proved, when a post-deploy normal-state check is missing or ambiguous, or when the newly deployed callback cannot complete its acceptance path. Never retry the candidate first.

```powershell
$rollbackWorktree = [IO.Path]::GetFullPath(
  (Join-Path (Get-Location) '.superpowers\sdd\oauth-reconnect-rollback-worktree')
)
$rollbackParent = [IO.Path]::GetFullPath(
  (Join-Path (Get-Location) '.superpowers\sdd')
)
if (
  -not $rollbackWorktree.StartsWith($rollbackParent, [StringComparison]::OrdinalIgnoreCase) -or
  -not (Test-Path -LiteralPath (Join-Path $rollbackWorktree 'dist\vision\wrangler.json'))
) {
  throw 'Verified previous-normal rollback artifact is unavailable'
}
Push-Location -LiteralPath $rollbackWorktree
try {
  & .\node_modules\.bin\wrangler.cmd deploy --config dist/vision/wrangler.json --name vision-preview *> $null
  $rollbackExit = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($rollbackExit -ne 0) {
  throw 'Previous reviewed normal rollback failed closed'
}
'rolled_back=true'
```

Expected sole local fact: `rolled_back=true`. Then require healthy unauthenticated health, exactly two permanent schedules, no temporary one-minute route, and no temporary binding. If those checks pass, record only `rollback_verified=true`, remove the exact ignored rollback worktree using Step 8's cleanup block, contain the incident, and stop. If rollback or its verification fails, leave the incident contained and perform no further deployment, login, database, provider, key, or calendar action.

- [ ] **Step 5: Verify every non-credential live precondition before owner interaction**

Use bounded privacy-safe checks to require:

```text
unauthenticated health = healthy
deployed environment = preview
permanent schedules = exactly 2
temporary one-minute route = absent
temporary acceptance binding = absent
backup key version = unchanged at 1 (from existing evidence; do not read the key)
```

Capture only booleans, bounded counts, fixed categories, and UTC timestamps. If any condition fails, stop before asking the owner to sign in.

- [ ] **Step 6: Perform one fresh real reconnect with owner-only Google interaction**

Before opening sign-in, start one fresh bounded Wrangler Tail observation and
filter its retained result to only the newest fixed `errorCategory` for
`action: auth.callback`; discard every raw line and stop the observer after this
single attempt. Then open Vision's normal sign-in control. If Google requires
account choice or consent, ask the owner to complete only that visible Google
step. Automation must not inspect account text, authorization parameters,
callback data, or browser storage.

Expected browser result:

```text
access-denied page = false
authentication-failed page = false
authenticated calendar desk = true
calendar setup connected = true
```

If the page fails, retain only the already-running observer's newest fixed
category, execute Step 4, then diagnose that exact category before changing
code. Do not repeat the sign-in attempt until the new diagnosis is reviewed.

- [ ] **Step 7: Prove post-reconnect health and exact stale-marker removal**

Through signed-in Vision controls, require fresh diagnostics and calendar reads to succeed. Through a Boolean-only owner-scoped database check, require:

```text
token/setup/connection/checkpoint/maintenance canonical alignment = true
checkpoint connected = true
checkpoint error category absent = true
credential marker version absent = true
credential marker category absent = true
credential marker timestamp absent = true
```

Do not return row values, identities, token metadata, timestamps from private rows, provider identifiers, or encrypted fields. Recheck exactly two schedules and absence of the temporary binding after authentication.

- [ ] **Step 8: Remove both exact artifact worktrees, close the incident, and resume Task 8**

After every candidate acceptance fact in Steps 5-7 is proved, remove only the two exact ignored artifact worktrees:

```powershell
$artifactParent = [IO.Path]::GetFullPath(
  (Join-Path (Get-Location) '.superpowers\sdd')
)
$candidateWorktree = [IO.Path]::GetFullPath(
  (Join-Path $artifactParent 'oauth-reconnect-candidate-worktree')
)
$rollbackWorktree = [IO.Path]::GetFullPath(
  (Join-Path $artifactParent 'oauth-reconnect-rollback-worktree')
)
if (
  -not $candidateWorktree.StartsWith($artifactParent, [StringComparison]::OrdinalIgnoreCase) -or
  -not $rollbackWorktree.StartsWith($artifactParent, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'Artifact cleanup escaped its exact ignored parent'
}
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" worktree remove --force -- $candidateWorktree
git -c "safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation" worktree remove --force -- $rollbackWorktree
if (
  (Test-Path -LiteralPath $candidateWorktree) -or
  (Test-Path -LiteralPath $rollbackWorktree)
) {
  throw 'Artifact worktree cleanup did not complete'
}
```

Append only the safe closed facts and UTC observation window to ignored local evidence. Update the reconnect incident to `closed` with confirmed cause, correction, prevention, exact reviewed commit, and the safe verification categories; leave it unstaged for the Task 10 ledger review.

Resume `docs/superpowers/plans/2026-07-29-phase-b-live-acceptance-closure.md` at Task 8 Step 1, reusing already-valid immutable evidence and continuing to Step 2's permanent normal-artifact proof. This repair does not itself claim completion of the remaining maintenance, legacy-gate, normal-sync, missed-signal, auth-lifecycle, AI, cleanup, deployment-evidence, or Phase C handoff work.

Expected: the stale-reconnect blocker is closed and Phase B acceptance continues from its authoritative sequence without repeating completed single-attempt work.
