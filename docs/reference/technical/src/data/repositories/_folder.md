# `src/data/repositories`

Repository implementations own query and transaction boundaries, accept pure
domain types, and do not expose protected content. Phase C adds a dedicated
owner-scoped approval/ledger implementation: only the approval repository
decrypts the proposal after the owner predicate has matched, while the
execution ledger stores provider identity and version but never event body.
