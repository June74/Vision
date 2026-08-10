# SB-20260803-165501-native-capture-exit-invalid: Native capture child returned a nonzero exit

- **Status:** closed
- **First observed:** 2026-08-03T16:55:01.020563Z
- **Last observed:** 2026-08-03T17:52:43.9761767Z
- **Phase/task:** Phase B corrected redeploy controller timeout repair
- **Environment:** Owner-run Windows PowerShell 5.1 local native-process suite
- **Version/commit:** candidate `c1911f8`; ignored local corrected redeploy controller

## Symptom

Owner-run native process suite stopped at native_capture_exit_invalid

## Impact

Candidate deployment remains paused; no network, provider, database, credential, key, or live state changed

## Reproduction conditions

Run the local corrected redeploy native suite after the timeout contract passes.
The suite reaches `test-corrected-redeploy-native-capture.ps1`, launches its
bounded child, and rejects the returned result before testing output equality.

## Safe evidence

The owner reported only `native_capture_exit_invalid` and a runtime exception.
The earlier timeout contract passed, and all parser/correlation/source/query-
bounding/recovery static contracts passed. The capture test contains no
network or provider command and uses a fixed non-private expected string.

## Attempts and outcomes

- Direct invocation of the same fixed PowerShell expression returned exit zero
  and the exact expected output inside the local shell boundary.
- The production controller was not changed after the unexpected suite result.
- The helper-based `-File` isolation rerun returned
  `native_capture_exit_absent`, proving the result has one item but no readable
  exit-code value.
- Replacing only the native core with a safe in-memory result proved the
  `Invoke-NativeCaptured` wrapper preserves one object, exit zero, and exact
  output.
- The shape-classifying rerun returned `native_capture_exit_null`: the intended
  result object and property both exist, but the copied native exit-code value
  is null.
- Refreshing the `Start-Process` result before the read still returned the
  fail-closed category `native_process_exit_code_unavailable`.
- Replacing the adapter with direct `System.Diagnostics.Process` ownership made
  the isolated capture test return `native_capture_contract_ok`, including
  exact exit codes zero and seven.

## Cause classification

- **Confirmed cause:** Windows PowerShell `Start-Process` did not preserve a
  readable exit-code value for this bounded redirected-process lifecycle.
  Direct `System.Diagnostics.Process` ownership preserved exact zero and
  nonzero exit codes with the same redirected capture contract.
- **Hypotheses:** None remaining for the isolated capture failure.
- **Rejected hypotheses:** The fixed expression itself is invalid; a direct
  child invocation returned zero with exact output. Inline `-Command` parsing
  caused the failure; the isolated `-File` helper produced the same missing-
  exit result. The capture wrapper discards the result shape; its in-memory
  core control preserved the exact object. The core emitted a wrong scalar or
  object; shape classification proved the intended property exists. Refreshing
  the `Start-Process` result restores the exit value; the rerun still returned
  `native_process_exit_code_unavailable`.
- **Known exclusions:** No timeout category, child-start category, network,
  provider, database, credential, key, or live-state change occurred.

## Correction and prevention

- **Correction:** Replace the `Start-Process` core with direct
  `System.Diagnostics.ProcessStartInfo`/`Process` lifecycle ownership, retaining
  the same timeout, input closure, output capture, and tree cleanup contracts.
- **Prevention:** Keep capture, argument transport, and process-tree cleanup as
  separate regression contracts so one failure has one interpretation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; retain exact zero/nonzero capture tests.

## Verification and related work

The direct fixed-expression and wrapper-only controls pass. The direct .NET
capture regression returned `native_capture_contract_ok` for exact exit codes
zero and seven. The complete twelve-check suite passed, and independent review
found no remaining Critical or Important process-lifecycle issue.

## Recurrence history

- 2026-08-03T16:55:01.020563Z: First observed.
- 2026-08-03T16:56:43.0091714Z: Direct control succeeded; capture and inline
  argument transport are being separated before any production change.
- 2026-08-03T16:59:34.4481470Z: Helper-based isolation returned
  `native_capture_exit_absent`; wrapper-only control passed, localizing the
  defect to the native core's emitted result shape.
- 2026-08-03T17:05:19.4497463Z: Shape classification returned
  `native_capture_exit_null`. A refresh-before-read fix and explicit unavailable
  category were added for the next isolated rerun.
- 2026-08-03T17:07:38.4313865Z: Refresh was rejected by the owner-run category
  `native_process_exit_code_unavailable`. The `Start-Process` architecture is
  being replaced rather than patched again.
- 2026-08-03T17:11:26.5848523Z: Direct .NET process ownership passed the
  isolated zero/nonzero capture regression. Combined-suite verification is
  pending before closure.
- 2026-08-03T17:52:43.9761767Z: Combined verification and independent review
  passed; incident closed.
