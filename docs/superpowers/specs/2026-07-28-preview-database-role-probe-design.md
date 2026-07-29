# Preview Database Role Probe Design

**Status:** Approved
**Environment:** Preview only
**Purpose:** Resolve the Task 3 database-role uncertainty without claiming the
restore fence or changing database data.

## Context

The reviewed fenced restore candidate checks `current_user=vision_app` only
after it claims the one-shot R2 attempt marker. The signed-in Neon UI showed
the `vision_app` role selected, while a SQL Editor result appeared to report a
different current role. That editor result is not decisive because the SQL
Editor may retain a separate session and its result grid did not provide a
fully proven header-to-cell mapping.

The production connection string therefore needs one read-only check through
the same Worker and Neon pool boundary used by the destructive candidate.

## Approved approach

Create a temporary preview-only scheduled Worker candidate that:

1. accepts only `VISION_ENV=preview` and
   `PREVIEW_RESTORE_DATABASE_URL`;
2. opens `Pool({ connectionString, max: 1 })`;
3. obtains one retained client;
4. executes only `select current_user = 'vision_app' as role_ok`;
5. requires exactly one row containing a literal boolean;
6. releases the client and closes the pool on every path; and
7. emits only a closed, value-free `vision.preview-role-probe/v1` record.

The confirmed live path is:

```text
Cloudflare one-minute preview cron
  -> src/worker.ts scheduled export
  -> src/jobs/scheduled.ts scheduled()
  -> runScheduledJob()
  -> temporary preview role probe
  -> read-only Neon pool adapter
  -> fixed allowlisted evidence
  -> restore-only normal runtime
```

No HTTP route is added.

## Evidence contract

The only accepted success is:

```text
evidenceType=vision.preview-role-probe/v1
outcome=succeeded
category=none
roleMatches=true
```

Closed failures may report only:

```text
evidenceType=vision.preview-role-probe/v1
outcome=failed
category=
  role_probe_configuration_invalid |
  role_probe_query_failed |
  role_probe_role_mismatch
roleMatches=false
```

No database role name returned by PostgreSQL, connection information, target
identity, error text, SQL text, provider identifier, secret value, or
authenticated URL may enter logs, evidence, tests, reports, or documentation.

## Deployment sequence

1. Create only the temporary `PREVIEW_RESTORE_DATABASE_URL` Worker secret
   through signed-in provider controls.
2. Start the probe-only safe-tail observer and prove it is actively listening.
3. Deploy the exact reviewed probe commit while the observer remains active.
4. Accept exactly one unambiguous success record.
5. Immediately deploy immutable normal preview ref `40872a5`.
6. If the probe fails or is ambiguous, permanently delete the temporary
   database-URL secret and stop without continuing the restore.
7. If the probe succeeds, keep the already-created database-URL secret only
   long enough to recreate `PREVIEW_RESTORE_TARGET_ID` and execute the
   previously approved fenced restore at exact commit `0f08fc1`.

## Safety boundaries

- The probe never imports the restore engine, clear adapter, backup reader, or
  R2 attempt store.
- The probe never reads or writes an R2 object.
- The probe never begins a transaction and never executes a mutation
  statement.
- The probe never reads tables, rows, attestation values, or target identity.
- The probe never uses `DATABASE_URL`; it accepts only the temporary disposable
  target binding.
- Missing, malformed, duplicate, nonboolean, or thrown results fail closed.
- Pool creation, client acquisition, query, release, and pool close failures
  produce only closed evidence.
- `BACKUP_ENCRYPTION_KEY` remains unchanged at key version 1.
- `backups/v1/` is never accessed.

## Alternatives rejected

1. **Trust the Neon selected-role UI.** Rejected because UI selection does not
   prove the generated connection's PostgreSQL role.
2. **Deploy the destructive candidate and let it check the role.** Rejected
   because a wrong role would burn the one-shot R2 marker before providing the
   answer.
3. **Trust the SQL Editor grid.** Rejected because the editor may retain a
   separate session and its virtualized result mapping was not fully proven.

## Verification

Test-driven implementation must cover:

- exact preview-only environment validation;
- exactly one `true` result;
- `false`, missing, extra, nonboolean, and thrown query results;
- pool/client release and close on every success and failure path;
- fixed-schema logging with no raw values or errors;
- scheduler routing for only the temporary one-minute cron;
- probe-only safe-tail acceptance and rejection;
- workflow listener-before-deployment behavior; and
- proof that the probe module has no R2, restore, clear, backup-key, or public
  route capability.

Implementation requires an independent specification and code-quality review
with zero Critical or Important findings before live use.
