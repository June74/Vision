# `src/domain/graph/node.ts`

This module gives every Vision graph object the same basic record: who owns it, what type it is, its category, privacy, source, dates, and version.

## `NodeEnvelopeSchema`

`NodeEnvelopeSchema` accepts only registered object types, requires a complete identity, checks valid category/state pairs, and limits model confidence to inferred categories.

## `NodeIdentitySchema`

`NodeIdentitySchema` requires every node to say whether it came from a provider, Vision itself, or a Vision system process, with a complete system and ID.
