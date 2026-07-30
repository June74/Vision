# `scripts/prepare-preview-acceptance-deploy-config.ts`

Creates the isolated, generated preview acceptance candidate from the exact
normal artifact. The source must satisfy `validatePreviewDeployConfig`; the
returned clone must satisfy `validatePreviewAcceptanceDeployConfig`.

The selector vocabulary comes from the domain module. Synchronization
suppression receives a ten-minute expiry and only the two normal schedules;
the other admitted candidates retain the additional one-minute schedule.

## `serializePreviewAcceptanceContext`

Canonicalizes a closed context variant, emits ASCII-only whitespace-free JSON,
and enforces the 2,048-byte transport ceiling.

## `parsePreviewAcceptanceContext`

Parses canonical JSON, enforces exact ordered keys and operation agreement,
requires byte identity with serializer output, derives the selector, and
deeply freezes the returned selection.

## `canonicalPreviewAcceptanceContext`

Validates the version, operation, reviewed commit, lifecycle grammar,
ordered candidate timestamp interval, evidence outcome pairing, and
fault-scenario presence before constructing a new ordered plain object.
Candidate bounds may be equal but may not be reversed.

## `isBoundedAscii`

Rejects non-ASCII, control-character, and oversized transport strings.

## `exactPlainRecord`

Requires `Object.prototype`, string keys, and enumerable data properties.

## `dataValue`

Uses property descriptors to read a data value without invoking accessors.

## `exactKeys`

Compares complete own-key membership for one discriminated variant without
trusting caller insertion order. Raw parser input still has to match the
canonical serializer bytes.

## `isCanonicalInstant`

Requires the millisecond UTC grammar and round-trip timestamp identity.

## `preparePreviewAcceptanceDeployConfig`

Validates the normal artifact, performs a structured clone, retains only the
two normal schedules for synchronization suppression, and adds the temporary
one-minute cron for every other acceptance candidate. It also adds the
canonical bounded expiry and admitted bindings before validating the complete
candidate.

## `isRunRef`

Requires a positive decimal lifecycle reference without coercion or leading
zeroes.

## `readArguments`

Parses unique `--name value` pairs without aliases or coercion. The dedicated
workflow-verification flag is handled before this parser.

## `readWorkflowSelectionFromEnvironment`

Reads operation and context only from the step environment, validates them,
then proves dispatch and checkout commit equality before returning selection.

## `main`

`--verify-workflow-inputs` validates dispatch selection without reading or
writing deployment artifacts and emits only validated scalar outputs.
Candidate generation accepts only the fixed artifact paths and attestation
flag, then uses exclusive creation so an existing candidate cannot be
overwritten.
