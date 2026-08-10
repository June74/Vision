# SB-20260803-171736-native-argument-roundtrip-encoding: Native argument roundtrip fixture decoded with legacy encoding

- **Status:** closed
- **First observed:** 2026-08-03T17:17:36.819213Z
- **Last observed:** 2026-08-03T17:24:43.2774368Z
- **Phase/task:** Phase B corrected redeploy controller verification
- **Environment:** Windows PowerShell 5.1 local native-process contract suite
- **Version/commit:** candidate `c1911f8`; ignored local corrected redeploy tests

## Symptom

The full native suite passed timeout, capture, process API, and argument count checks, then failed native_argument_roundtrip_invalid.

## Impact

The controller cannot yet be declared verified and candidate deployment remains paused.

## Reproduction conditions

Run the native tree and argument test under Windows PowerShell 5.1. The child
writes a JSON fixture containing one non-ASCII argument as UTF-8 without a byte
order mark, and the parent originally read it with `Get-Content` without an
explicit encoding.

## Safe evidence

- The corrected argument-count normalization produced six decoded values.
- A diagnostic-only indexed failure identified value index 5, the sole
  non-ASCII fixture, as the mismatch.
- The preceding five ASCII and shell-metacharacter fixtures round-tripped
  exactly.

## Attempts and outcomes

1. Added a safe mismatch index to the assertion; the test reported
   `native_argument_roundtrip_invalid:5`.
2. Kept the controller unchanged and made both fixture writing and reading use
   strict UTF-8 explicitly.

## Cause classification

- **Confirmed cause:** Windows PowerShell 5.1 read the UTF-8 JSON fixture through
  its legacy default text encoding, changing the one non-ASCII test value.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Argument loss or corruption in the controller's
  Windows command-line quoting.
- **Known exclusions:** Spaces, quotes, percent signs, ampersands, and carets all
  completed the exact roundtrip before the non-ASCII mismatch.

## Correction and prevention

- **Correction:** The fixture writer and reader now use the same strict UTF-8
  encoding explicitly.
- **Prevention:** Encoding-sensitive Windows PowerShell tests must never rely on
  cmdlet default encodings.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; retain the strict UTF-8 fixture boundary.

## Verification and related work

The focused argument/tree test passed, followed by the complete native suite,
which ended with `corrected_redeploy_native_suite_ok`.

## Recurrence history

- 2026-08-03T17:17:36.819213Z: First observed.
- 2026-08-03T17:18:37.9595206Z: Isolated to the sole non-ASCII fixture and
  corrected the fixture's encoding boundary.
- 2026-08-03T17:24:43.2774368Z: Focused and full-suite verification passed;
  incident closed.
