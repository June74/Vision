# `src/integrations/openai/context-builder.ts`

This module is the disclosure boundary between protected event storage and AI inference. Inputs are hostile: known fields are read through own data descriptors, and output is reconstructed rather than spread or serialized from input.

The packet contains a bounded opaque event ID, normalized offset-bearing schedule, optional opaque source association, explicit title representation, permitted evidence, and policy version. Tokens, attendee data, email, meeting URLs, locations, descriptions, notes, HTML, ciphertext, and arbitrary fields have no output path.

## `readOwnDataProperty`

Uses `Object.getOwnPropertyDescriptor` and rejects absent, non-enumerable, accessor, and proxy-trapped properties.

## `readOptionalOwnDataProperty`

Uses the same descriptor boundary for an optional field and distinguishes absence from an unsafe accessor.

## `requirePlainRecord`

Requires a non-array object with `Object.prototype` or a null prototype and catches prototype traps.

## `readPlainArrayData`

Requires an ordinary array, bounds its length, rejects extra keys or accessors, and copies each indexed data descriptor without property reads.

## `requireIdentifier`

Validates a non-empty opaque identifier against the closed character set and length bound.

## `buildTitle`

Does not inspect `event.title` for `omit` or caller-supplied token mode. Plaintext mode reads and bounds the title only after explicit policy permission.

## `buildEvidence`

Reconstructs at most 16 unique `{ id, fact }` records. Extra properties are not copied, while missing, accessor-backed, duplicate, or oversized facts fail closed.

## `buildCategoryContext`

Validates offset-bearing RFC 3339 schedule facts, a bounded IANA time zone, positive duration, evidence, and policy version. It returns a newly allocated closed packet with no provider or action authority.
