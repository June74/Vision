# `src/domain/graph/node.ts`

This module gives every Vision graph object the same basic record: who owns it, what type it is, its category, privacy, source, dates, and version.

## `NodeEnvelopeSchema`

`NodeEnvelopeSchema` accepts only registered object types and checks that only inferred categories carry model confidence.
