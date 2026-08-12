# Preview tail bounded dialect matcher design

**Date:** 2026-08-12
**Status:** User-approved design; implementation not started
**Phase:** B - permanent maintenance acceptance diagnosis

## Context

The live acceptance path is:

```text
preview.yml tail step
  -> run-preview-tail-supervisor.ts
  -> print-safe-tail.ts
  -> fixed observer failure marker
  -> supervisor category mapping
```

One fresh observer run produced the safe tuple
`consumer_unrecognised`, `consumer_exit=1`, and
`producer_closed_first=false`. That proves the consumer closed on its own and
emitted stderr, but the supervisor did not recognize the marker dialect.
Provider output is intentionally unavailable at this boundary.

The emitter currently defines six maintenance failure categories that the
supervisor's local allowlist omits. The duplicated definitions can therefore
drift again.

## Goal

Create one shared, fail-closed protocol definition for observer failure
markers so the emitter and supervisor recognize exactly the same bounded
dialect while preserving the privacy boundary.

## Non-goals

- Do not forward, retain, or parse arbitrary runner or provider stderr.
- Do not accept unknown future categories automatically.
- Do not change maintenance semantics, schedules, deployment behavior,
  rollback behavior, credentials, secrets, database state, or Cloudflare
  configuration.
- Do not treat a recognized category as proof that the underlying maintenance
  operation succeeded or failed for a particular provider reason.

## Approaches considered

### 1. Duplicate the missing cases in the supervisor

Add the six cases to `run-preview-tail-supervisor.ts` and leave the emitter's
type separate. This is the smallest patch, but it preserves the drift that
caused the diagnosis gap.

### 2. Shared protocol module - selected

Create `scripts/preview-tail-observer-dialect.ts` containing the exact category
tuple, its type, the bounded marker parser, and the marker grammar. Have
`print-safe-tail.ts` import the tuple/type from that module, and have the
supervisor import the parser/type before applying its existing prefixed mapping.
The emitter and consumer then share one source of truth without sharing
provider data or process state.

### 3. Syntax-only future-proof matching

Accept any token matching `[a-z][a-z0-9_]{0,63}` and map unknown values to a
generic result. This is rejected: a syntactically valid but unreviewed token
could cross the privacy boundary without an understood safe meaning.

## Chosen design

### Shared category vocabulary

The shared tuple contains exactly these fourteen categories currently emitted
by `print-safe-tail.ts`:

```text
invalid_configuration
observer_window_invalid
observer_no_matching_evidence
rejected_terminal_event
evidence_rejected_by_expectation
maintenance_schedule_mismatch
maintenance_outcome_mismatch
maintenance_category_mismatch
maintenance_repair_failure
maintenance_renewal_failure
maintenance_repair_not_reserved
observer_uniqueness_failed
observer_runtime_error
input_closed_before_evidence
```

The tuple is immutable. The supervisor maps each admitted raw category to its
existing prefixed `PreviewTailFailureCategory` (for example,
`maintenance_schedule_mismatch` becomes
`consumer_maintenance_schedule_mismatch`). Unknown categories remain
`consumer_unrecognised`.

The mapping is an exact record for the shared tuple: every admitted raw token
maps to the corresponding `consumer_<token>` category, and no raw token may be
accepted without a mapping entry. This adds the six missing supervisor
categories `consumer_maintenance_schedule_mismatch`,
`consumer_maintenance_outcome_mismatch`,
`consumer_maintenance_category_mismatch`,
`consumer_maintenance_repair_failure`,
`consumer_maintenance_renewal_failure`, and
`consumer_maintenance_repair_not_reserved`.

### Marker grammar

Only a complete line in this form is admitted:

```text
Preview tail observer failed closed: <one-shared-category>.
```

The parser must require:

- the exact fixed prefix and period;
- one category from the shared immutable tuple;
- a line boundary or end-of-buffer on both sides;
- no additional fields, values, stack text, or provider-controlled content;
- a bounded input window no larger than 128 UTF-8 bytes.

The supervisor may receive stderr in arbitrary chunks. It retains only the
bounded suffix needed to join a split marker, runs the parser over that suffix,
and discards all other bytes. CRLF and LF line endings are accepted; all other
forms are rejected.

### Data flow and failure behavior

```text
print-safe-tail emitObserverFailure(category)
  -> shared fixed marker
  -> bounded chunk suffix
  -> shared parser
  -> exact supervisor mapping
  -> safe category + lifecycle facts
```

If the marker is absent, malformed, unknown, oversized, or contains extra
content, the existing fallback remains `consumer_unrecognised`. A zero-byte
stderr stream remains `consumer_silent`. The parser never returns raw text.

## Test design

Implementation is test-first:

1. Add a failing shared-protocol test for every emitted category, including all
   six maintenance categories currently missing from the supervisor.
2. Add RED tests for unknown categories, extra fields, prefix/suffix injection,
   malformed punctuation, oversized input, and non-line-bounded matches.
3. Add split-chunk tests that feed marker fragments across every meaningful
   boundary while retaining only the bounded suffix.
4. Add a consistency test proving the emitter's category type and the shared
   tuple cannot diverge at runtime.
5. Add supervisor mapping tests proving each admitted raw category maps to its
   prefixed safe category and that unknown values remain unrecognised.
6. Preserve existing tests proving child stderr and sentinel strings never
   appear in returned output.

Verification must include the focused supervisor/observer tests, the full unit
suite, typecheck, documentation coverage, production build, and diff checks.

## Operational validation

After local verification and review, dispatch one fresh maintenance observer at
the exact reviewed commit captured at dispatch time. Report only the category,
consumer exit code, and producer-closed-first flag. Do not open a support case
from the old generic classification, rotate credentials, or deploy based on
the matcher change alone.

## Rollback

If local verification fails, revert only the shared dialect module, its imports,
the supervisor mappings, and their tests/documentation. No provider rollback or
secret action is part of this change.
