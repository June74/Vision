# prepare-preview-acceptance-deploy-config

Builds one temporary preview acceptance deployment file from the already
validated normal preview file. The normal file is never edited.

The command accepts one approved operation plus one canonical, versioned
context string. Synchronization suppression keeps the two normal schedules;
every other acceptance candidate adds the temporary one-minute schedule. The
command adds the admitted temporary bindings without editing the normal
artifact. A normal-deploy context must identify either the empty baseline or
the latest candidate and its exact rollback closure. Calendar-maintenance
observe contexts carry only the canonical
scheduled tick; the observer derives its two-minute close internally.

## `serializePreviewAcceptanceContext`

Builds whitespace-free ASCII JSON with the exact ordered keys for one closed
context variant.

## `parsePreviewAcceptanceContext`

Rejects noncanonical, oversized, reordered, duplicated, mismatched, or
unsupported context and returns a deeply frozen workflow selection.

## `canonicalPreviewAcceptanceContext`

Validates one context variant and rebuilds a new plain object in authoritative
key order. Candidate dispatch timestamps must be ordered; a zero-width
interval is valid. Evidence families must match their expected outcomes, and a
maintenance context must carry exactly one canonical scheduled tick.
Only the AI-success observe variant can carry its required evidence time and
expiry; every other observe variant rejects both fields in its type and parser.
Normal deployment requires a matched baseline pair or two positive lifecycle
references so the workflow can prove there is no open candidate.

## `isBoundedAscii`

Requires printable ASCII transport no larger than 2,048 bytes.

## `exactPlainRecord`

Rejects arrays, custom prototypes, symbols, hidden properties, and
accessor-backed properties.

## `dataValue`

Reads one own enumerable data property without invoking an accessor.

## `exactKeys`

Requires exact key membership without requiring the caller's insertion order.
The parser separately rejects raw JSON whose keys are not in canonical order.

## `isCanonicalInstant`

Accepts only byte-stable UTC timestamps.

## `preparePreviewAcceptanceDeployConfig`

Returns a new validated candidate with one bounded expiry while leaving the
normal input unchanged.

## `isRunRef`

Accepts only a positive decimal lifecycle reference without a leading zero.

## `readArguments`

Accepts only unique named flag pairs. Aliases, repeats, missing values, and
positional values fail closed.

## `readWorkflowSelectionFromEnvironment`

Parses context from the step environment and requires both the dispatch commit
and checked-out commit to equal the reviewed commit.

## `main`

Supports canonical workflow-input verification and the fixed generated-file
build mode. It never accepts the context as a shell argument, writes only the
fixed acceptance artifact, and refuses to overwrite an existing file. Workflow
verification emits only fixed snake-case scalar outputs, including evidence
family, expected outcome, maintenance tick, and the single
restore-admission gate name.

## `parseCanonicalAiWindow`

Reuses the strict domain parser for the scheduled-at and expiry values carried
inside an AI observe or deploy context.

## `createPreviewDispatchCorrelationEvidence`

Creates a small evidence record that binds one operation and reviewed commit to
the exact serialized dispatch context without copying that context into the
evidence.

## `assertPreviewDispatchCorrelationEvidence`

Rejects correlation evidence unless its type, operation, commit, and context
fingerprint all match the exact dispatch being verified.

## `readBoundedUtf8File`

Reads one required UTF-8 file through a single bounded handle and rejects empty,
oversized, or invalid text.

## `verifyDispatchCorrelation`

Runs the closed file-based correlation check and emits only the fixed verified
or rejected result.
