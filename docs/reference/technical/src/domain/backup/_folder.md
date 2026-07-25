# `src/domain/backup`

Owns the provider-neutral logical-backup contract. The table list is dependency-safe and closed at migration 9, so
format readers cannot silently accept an unknown schema or omit a newly authoritative table.
