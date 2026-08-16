# Calendar-write schema

This additive schema keeps Phase C approval content and provider execution
state in separate tables.

`calendar_write_approvals` stores one owner-scoped operation, controlled
provider/calendar/domain metadata, proposed/confirmed/invalidated status,
expiry timestamps, and a non-null encrypted proposal envelope. It never stores
title or description as ordinary database text.

`calendar_write_operations` stores the exactly-one create ledger. It records
owner/provider/calendar scope, writing/pending/verified/failed/undone status,
timestamps, and paired provider event identity/version only after verification.

The migration is additive and includes checks for provider, non-empty identity,
valid statuses, expiry ordering, paired event fields, and terminal identity.
