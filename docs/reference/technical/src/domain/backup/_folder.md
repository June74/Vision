# `src/domain/backup`

Owns the provider-neutral logical-backup contract. The table list is dependency-safe and closed at migration 9, while
the schema contract pins columns, SQL types, nullability, checks, primary and alternate identities, and foreign keys so
format readers cannot silently accept an unknown schema or omit a newly authoritative constraint.
