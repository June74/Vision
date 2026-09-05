# Recovery conflict predicate diagnostic design

## Approval and scope

The owner approved the narrowly scoped diagnostic extension, test-first verification,
and preview deployment after receiving `callback_authorization_recovery_conflict`.
This records that approved design; it is not an authentication-rule repair.
Hard line: **no more than 20 agents at once**. Use the existing Projects fix worktree;
do not touch main, production, secrets, migrations, or live database records.

## Confirmed live path

`createApp -> registerOAuthRoutes -> callback token persistence ->
AuthorizationRecoveryPort.recoverAfterReconnect ->
ChannelMaintenanceRepository.recoverAuthorizationAfterReconnect -> session decision`.

The previous diagnostic proves an explicit conflict, but not the rejected predicate.
Separate SQL snapshots cannot identify callback-time token metadata or concurrent changes.
The six previous network-disabled Neon-driver probes are synthetic evidence only.

## Data boundary

Preserve the existing repository return contract `recovered | not_needed | conflict`.
Add an optional second argument, `AuthorizationRecoveryConflictObserver`, that receives
only an authored `AuthorizationRecoveryConflictReason`. Existing callers remain valid.
The single existing SQL statement gains a final projection named `conflict_reason`.
It reads only existing materialized locked CTEs and the existing decision. Do not
change locks, joins/predicates in the admission topology, decision precedence, update
CTEs, atomicity assertion, parameters used by existing predicates, or row decoding
of the outcome. No additional query and no reason is persisted.

Classify only when the existing outcome is conflict; otherwise return SQL null.
Token checks precede topology checks; topology checks precede marker checks.
Use null-safe comparisons. Multiple mismatches report the first in this authored
order, not an exhaustive state disclosure:

- `token_missing`
- `token_subject_mismatch`
- `token_version_mismatch`
- `token_timestamp_mismatch`
- `setup_subject_mismatch`
- `connection_missing`
- `connection_subject_mismatch`
- `connection_summary_mismatch`
- `connection_role_mismatch`
- `checkpoint_missing`
- `maintenance_missing`
- `maintenance_setup_version_mismatch`
- `maintenance_checkpoint_version_mismatch`
- `topology_unclassified`
- `connected_marker_present`
- `authorization_marker_version_mismatch`
- `authorization_marker_category_mismatch`
- `authorization_marker_timestamp_mismatch`
- `authorization_token_not_newer`
- `unclassified`

Token distinctions are missing owner row, subject, version, and exact persisted
timestamp. Topology distinctions cover setup identity, connection existence/identity/
summary/owner role, checkpoint and maintenance existence, setup version, and the
unchanged checkpoint-version/connected-unmarked-lag predicate. The fallback
`topology_unclassified` avoids inventing a cause when no named predicate explains it.
Marker distinctions cover a connected checkpoint with any marker, or a disconnected
authorization checkpoint whose marker version/category/time or token freshness fails.
Unknown/malformed reason values reduce to `unclassified`, never arbitrary text.

Invoke the observer only after a valid conflict outcome. Its optional notification
must not change the repository outcome even if the observer throws. Never provide
the SQL result, exceptions, inputs, or metadata to it.

## HTTP boundary

Reuse `AUTH_DIAGNOSTIC_STAGES`, `AuthStageError`, and the existing safe logger.
Map each non-unclassified reason to a literal `callback_recovery_<reason>` using
an explicit switch over unknown input. Unclassified/unknown input maps to the
existing `callback_authorization_recovery_conflict`. No string interpolation,
free-form logger schema, new header, or new endpoint.

The callback passes a request-local observer only for preview. It maps the observed
reason to a closed stage, then emits it only if the final outcome is conflict.
Throws and invalid outcomes retain `callback_authorization_recovery_failed`;
accepted outcomes retain session creation/rotation ordering regardless of an observer
notification. Production/local failure bodies and headers remain byte-identical and
their conflict logs retain the generic stage. The production dependency adapter
forwards the optional observer to the same owner-scoped repository instance.

## Verification and release

Test the actual migrated PGlite repository for every reachable reason, original
outcomes, all-table nonmutation on conflicts, successful recovery, no-op/lag cases,
owner isolation, nulls, fallback, and a throwing observer. Verify exactly one recovery
SQL execution and unchanged admission/update SQL. Test actual Worker responses/logs
for every category across local/preview/production, including malicious strings,
objects, invalid outcomes, exceptions, session preservation, and accepted outcomes.
Retain and run existing concurrency tests; do not label skipped external PostgreSQL
checks as live evidence.

Run focused RED then GREEN, typecheck, docs check, full `pnpm check`, browser suite,
preview build/config validation, no-upload Wrangler dry run, independent spec and
quality reviews, diff/security checks, and exact-SHA preview workflow. Do not remove
the diagnostic until the owner completes sign-in. Deployment success does not mean
sign-in or Phase C acceptance is complete.

## Removal

After confirmed sign-in, remove the optional observer/type/literal reason set,
final SQL diagnostic projection, mapping helper and new stages, route observer and
adapter forwarding, diagnostic tests and mirrored references together with the
existing temporary OAuth diagnostic. Preserve all actual authentication/recovery rules.
