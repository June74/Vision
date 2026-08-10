# SB-20260803-171352-native-argument-json-array-shape: Native argument test counted a JSON array wrapper

- **Status:** closed
- **First observed:** 2026-08-03T17:13:52.154359Z
- **Last observed:** 2026-08-03T17:24:43.2774368Z
- **Phase/task:** Phase B corrected redeploy controller timeout repair
- **Environment:** Owner-run Windows PowerShell 5.1 native suite and local parser control
- **Version/commit:** candidate `c1911f8`; ignored local corrected redeploy tests

## Symptom

Owner-run native suite stopped at native_argument_count_invalid after earlier core contracts passed

## Impact

Argument and descendant cleanup acceptance paused; no controller, network, provider, database, credential, key, or live state changed

## Reproduction conditions

Parse a JSON array directly inside an array subexpression pipeline on Windows
PowerShell 5.1, then compare it with assigning the decoded value first and
wrapping the assigned array afterward.

## Safe evidence

The native suite passed timeout, capture, and direct process API contracts, then
returned `native_argument_count_invalid`. A safe three-element local control
produced pipeline-wrapped count one with item type `System.Object[]`, while the
assigned-then-wrapped form produced count three. No argument values or private
data were logged.

## Attempts and outcomes

- The owner-run suite stopped before descendant cleanup because the decoded
  array wrapper was counted as one.
- The isolated parser-shape control reproduced count one and proved the
  assigned-then-wrapped form preserves the element count.

## Cause classification

- **Confirmed cause:** Windows PowerShell 5.1 emits the JSON array as one
  pipeline object inside the original array subexpression; the test counted
  that wrapper rather than its elements.
- **Hypotheses:** None remaining for the count failure.
- **Rejected hypotheses:** The reported count failure proves native argument
  loss; the test's own decoder shape reproduced the mismatch before comparing
  any element.
- **Known exclusions:** The controller source and process runner were not
  changed; no network, provider, database, credential, key, or live state was
  involved.

## Correction and prevention

- **Correction:** Assign `ConvertFrom-Json` output first, then normalize the
  assigned value with `@($decodedValues)` before comparing counts/elements.
- **Prevention:** Test PowerShell collection shape explicitly when a cmdlet can
  emit an array as one pipeline object.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; retain the collection-shape regression in the
  combined native suite.

## Verification and related work

The focused test and the combined native suite passed after normalization. The
combined run ended with `corrected_redeploy_native_suite_ok`.

## Recurrence history

- 2026-08-03T17:13:52.154359Z: First observed.
- 2026-08-03T17:14:04.7343541Z: Parser-shape control confirmed the test defect;
  assigned-array normalization was applied without changing controller code.
- 2026-08-03T17:24:43.2774368Z: Focused and full-suite verification passed;
  incident closed.
