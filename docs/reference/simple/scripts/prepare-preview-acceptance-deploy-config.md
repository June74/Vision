# prepare-preview-acceptance-deploy-config

Builds one temporary preview acceptance deployment file from the already
validated normal preview file. The normal file is never edited.

The command accepts one approved operation plus one canonical, versioned
context string. Synchronization suppression keeps the two normal schedules;
every other acceptance candidate adds the temporary one-minute schedule. The
command adds the admitted temporary bindings without editing the normal
artifact. Observe contexts carry their own canonical close instant. Calendar
artifact. Calendar-maintenance observe contexts carry only the canonical
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
