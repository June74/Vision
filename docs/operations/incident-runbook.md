# Phase B incident runbook

This runbook covers the private preview foundation. Never paste credentials,
database URLs, OAuth callbacks, authorization codes, tokens, encryption keys,
email addresses, cookies, protected event content, raw request bodies, or
provider-controlled URLs into commands, tickets, logs, or evidence.

## First response

1. Stop the affected mutation or deployment.
2. Preserve only fixed safe facts: timestamp, environment, commit, route or job
   name, HTTP status, allowlisted error category, retry count, and aggregate
   age/count.
3. Invoke the setback logger and search
   `docs/operations/setbacks/INDEX.md` before creating a new incident.
4. Confirm the exact current stage before proposing a fix.
5. Keep Vision in its truthful degraded state until fresh verification passes.

## User-visible state policy

| State | Meaning | First operator action |
|---|---|---|
| `Healthy` | Authorization, database, channel, queue, and sync freshness are within policy | Continue monitoring |
| `Delayed` | Sync is at least 20 minutes old, a queued job is at least 15 minutes old, a channel is expiring, or a retry/rebuild is scheduled | Inspect the safe checkpoint category and queue age; allow bounded repair |
| `Action required` | Database unavailable, failed jobs exist, channel missing/expired, schema/payload failure, or managed-service usage warning | Stop claiming completion; correct the exact dependency or data contract |
| `Disconnected` | Authorization is missing/revoked or the checkpoint is disconnected | Require a fresh owner-controlled Google authorization |

`Disconnected` takes precedence over `Action required`, which takes precedence
over `Delayed`. AI warnings never disable deterministic event viewing.

## Failure playbooks

### Delayed Queue

- Confirm only oldest-job age and retry count.
- Verify the Queue binding and consumer are present.
- Let the normal consumer retry; do not manually duplicate the payload.
- If age remains above 15 minutes, preserve `Delayed` and inspect the
  allowlisted job error category.

### Failed synchronization job

- Confirm failed-job count, checkpoint status, and safe category.
- Do not log payload or calendar identifiers.
- Retry only through the idempotent Queue path.
- Keep the interface at `Action required` until one fresh sync commits.

### Missing, expired, or expiring watch channel

- Expiring within 24 hours is `Delayed`; missing or expired is
  `Action required`.
- Run the normal renewal path, which activates the replacement before stopping
  the prior channel.
- Never copy callback tokens or channel identifiers into evidence.

### Revoked Google authorization

- Confirm only the `authorization` category or revoked state.
- Do not repeatedly refresh a revoked credential.
- Show `Disconnected` and require the owner to sign in and grant access again.

### Database outage

- Stop writes and preserve `Action required`.
- Verify managed-service status and connectivity without printing a connection
  string.
- Let Queue work retry with bounded backoff.
- Require a successful database read and a fresh sync before closing.

### R2 backup failure

- Stop backup acceptance; “uploaded” is not “verified”.
- Confirm only failure stage, date, key version, and checksum-match booleans.
- Check the private environment-specific bucket binding and retry on the normal
  schedule.
- Never open or print an object body in provider tooling.

### AI budget stop

- At 800 cents, warn and disable complex/Terra work.
- At 900 cents, stop optional work.
- At 950 cents, stop every new AI request.
- Do not raise the limit during incident response. Calendar and deterministic
  features must remain available.

### Deployment failure

- Confirm which guarded step failed.
- Inspect the minimum sanitized failure category.
- Never bypass verification by deploying an unverified commit.
- After correction, rerun the full guarded workflow and verify live health.

### Temporary preview candidate or rollback failure

- Stop further candidate deployment and preserve only the operation, reviewed
  commit, safe terminal category, and whether the observer was still active.
- Do not create or patch a deployment artifact by hand. Regenerate it only from
  the immutable normal artifact through the guarded workflow.
- Do not reuse an AI Gateway verification from an earlier workflow run. The
  dedicated AI evidence candidate requires its own same-run read-only result.
- Dispatch `rollback` as a separate operator action over the reviewed normal
  ref. Do not describe it as automatic cross-run recovery.
- Verify normal health, exactly the two normal schedules, and absence of the
  temporary selector, AI attestation, and one-minute schedule before provider
  cleanup or another candidate.
- Provider cleanup is last: first merge reviewed source cleanup, deploy it, and
  verify the permanent cleanup test and normal runtime. Never delete
  `backups/v1/`, backup key version 1, prepared-backup import or offline restore
  tooling, permanent maintenance evidence, usage warnings, or historical
  evidence and setback records.

## Recovery and closure

An incident closes only when the exact failed boundary is rerun successfully,
the truthful state returns, and the indexed incident records correction plus
prevention. A provider dashboard looking normal is not enough by itself.
