# `src/integrations/openai/context-builder.ts`

This module creates the small category packet Vision may send to an AI provider. It copies only approved identifiers, schedule facts, source association, title representation, evidence facts, and policy version.

## `readOwnDataProperty`

Reads a required normal data field without running a getter.

## `readOptionalOwnDataProperty`

Reads an optional normal data field without running a getter.

## `requirePlainRecord`

Rejects arrays, class instances, and hostile objects.

## `readPlainArrayData`

Copies a small ordinary array without running element getters.

## `requireIdentifier`

Accepts only a bounded opaque identifier.

## `buildTitle`

Omits the title by default and includes plaintext or tokens only when explicitly permitted.

## `buildEvidence`

Copies a small unique list of permitted evidence IDs and facts.

## `buildCategoryContext`

Builds and validates the complete minimum-context category packet.
