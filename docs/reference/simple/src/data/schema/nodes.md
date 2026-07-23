# `src/data/schema/nodes.ts`

This table keeps the common facts for every Vision graph object.

## `ciphertext`

`ciphertext` represents encrypted data kept as database bytes.

## `dataType`

`dataType` tells PostgreSQL to use `bytea` for those encrypted bytes.

## `nodes`

`nodes` stores ownership, identity, category, privacy, source, lifecycle dates, and version.
