# SB-20260731-022654-task3-controller-nosignal-first-green-failure: Task 3 no-signal settlement test remained red after type-safe implementation

- **Status:** closed
- **First observed:** 2026-07-31T02:26:54.462655Z
- **Last observed:** 2026-07-31T02:33:45.7354742Z
- **Phase/task:** Phase B Task 3 isolated controller no-signal repair
- **Environment:** Isolated controller-hardening worktree; focused Vitest
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus no-signal settlement repair

## Symptom

The focused no-signal settlement test remained red after the helper and result type compiled cleanly; the constant public failure was expected, leaving a post-closure read/count or rollback assertion mismatch.

## Impact

The controller lane paused before diagnosis; no protected detail, provider action, live request, or external state was exposed or changed.

## Reproduction conditions

Run the focused no-signal observer settlement test after completing the helper
return type and using the closed in-progress vocabulary.

## Safe evidence

The direct compiler returned zero diagnostics. The focused test returned the
expected constant public failure but one later assertion failed. No captured
stream or protected value was rendered.

## Attempts and outcomes

- The no-signal helper and result type were completed.
- The direct compiler passed.
- The first focused GREEN run isolated one post-closure assertion mismatch.
- Correcting a second fixture vocabulary mismatch (`uniqueness` in-progress)
  did not change the post-closure read-count failure.
- Six finite count probes were all unreachable because an earlier test
  assertion guessed the constant public error's punctuation incorrectly.

## Cause classification

- **Confirmed cause:** The fixture used two wrong in-progress vocabulary
  values and guessed punctuation/text for the constant safe failure. The
  controller's rollback and post-closure read cardinalities were already
  correct.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Compilation, the constant public failure contract,
  provider state, protected detail, live request, and external state are
  unaffected.

## Correction and prevention

- **Correction:** Use `listening` for both in-progress observer states and copy
  the neighboring exact `failed_closed` public contract rather than guessing
  message text.
- **Prevention:** Assert no-signal closure phases separately before the final
  aggregate result.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; continue signal-path causality and true-close
  cases.

## Verification and related work

Finite boolean probes proved rollback count 1 and post-closure observer-read
count 1, with all 0/2 alternatives false. The probes were removed, the focused
no-signal test passed, and the direct compiler returned zero diagnostics.

## Recurrence history

- 2026-07-31T02:26:54.462655Z: First observed.
- 2026-07-31T02:28:48.0552036Z: The second GREEN iteration corrected the
  uniqueness in-progress fixture state to `listening`, but the same
  post-closure read-count assertion remained red. No compiler run or further
  production edit occurred.
- 2026-07-31T02:31:39.1928445Z: All six finite count probes were false because
  the test never reached them; an earlier assertion had guessed punctuation in
  the constant public failure. Production behavior was unchanged. The exact
  message is relaxed only for diagnosis and must be restored from the
  neighboring known-good assertion before final verification.
- 2026-07-31T02:33:45.7354742Z: Closed after the known-good `failed_closed`
  assertion reached the probes, proving one rollback and one post-closure read.
  Temporary probes were removed; the focused test and direct compiler passed.
