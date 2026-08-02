# SB-20260727-211305-tool-result-shape-assumption: Tool-result wrapper was assumed incorrectly

- **Status:** closed
- **First observed:** 2026-07-27T21:13:05Z
- **Last observed:** 2026-08-02T02:15:47.9672991Z
- **Phase/task:** Phase B Task 7 reviewed-candidate publication
- **Environment:** Local Codex command orchestration
- **Version/commit:** Not applicable

## Symptom

An initial read-only orchestration wrapper assumed a structured result field that
was not present, producing a local wrapper error before project output was used.

## Impact

No repository, provider, or private state changed. The command was rerun with a
safe direct serialization of the returned value.

## Reproduction conditions

Format a command result as though it always contains an iterable content field.

## Safe evidence

The wrapper reported a missing-property type error. The direct serialization retry
completed and returned the requested local files.

## Attempts and outcomes

- The first wrapper failed before any project mutation.
- The retry serialized the returned value directly and completed.

## Cause classification

- **Confirmed cause:** The wrapper assumed an unavailable result shape.
- **Hypotheses:** None.
- **Rejected hypotheses:** The underlying local command was not the failure.
- **Known exclusions:** No source files, Git configuration, provider state, or
  sensitive values were changed.

## Correction and prevention

- **Correction:** Used direct result serialization for later read-only commands.
- **Prevention:** Inspect the actual tool-result contract before composing nested
  result fields.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The immediate retry completed without the wrapper error.

## Recurrence history

- 2026-07-30T01:32:37.0772417Z: A final verification wrapper grouped an
  intentionally nonzero strict-cleanup test with two passing checks. The
  expected RED made the wrapper fail and suppress the passing outputs. No
  repository or external state changed; final checks run separately so each
  exit is explicit.
- 2026-08-02T02:15:47.9672991Z: A private candidate-fingerprint equality check
  compared the entire command-result strings, which include changing execution
  metadata, instead of extracting the single fingerprint value. It therefore
  reported a false inequality. No candidate or external state changed. The
  corrected comparison required exactly one canonical fingerprint in each
  result, compared only those private values, and proved the reviewed candidate
  unchanged without displaying either value.
