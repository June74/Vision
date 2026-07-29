# SB-20260729-040600-fault-response-regex-overbroad: Fault response regex was overbroad

- **Status:** closed
- **First observed:** 2026-07-29T04:06:00.1311303Z
- **Last observed:** 2026-07-29T04:06:00.1311303Z
- **Phase/task:** Phase B acceptance instrumentation Task 5 RED
- **Environment:** Local Phase B worktree
- **Version/commit:** `1880cf9`

## Symptom

Three new response-boundary tests failed because a case-insensitive activation
value regex also matched legitimate uppercase warning codes.

## Impact

The first Worker RED run contained three wrong-reason failures in addition to
the expected paid-AI dispatch regression. No source outside the new tests,
runtime, provider, database, Queue, or object-storage state changed.

## Reproduction conditions

Compare exact lowercase fault activation values against a JSON response using
a case-insensitive regular expression while the response contains canonical
uppercase warning codes derived from the same words.

## Safe evidence

The focused Worker test named only the public warning-code strings and exited
nonzero. No private values were emitted or retained.

## Attempts and outcomes

- The broad regex produced false positives for queue, channel, and database
  warning codes.
- The assertion was narrowed to exact case-sensitive activation values.

## Cause classification

- **Confirmed cause:** The assertion ignored case even though case separates
  private server activation values from public warning-code vocabulary.
- **Hypotheses:** None.
- **Rejected hypotheses:** The API did not return the lowercase activation
  binding or scenario value.
- **Known exclusions:** No provider call or external mutation was caused by
  this assertion failure.

## Correction and prevention

- **Correction:** Match exact lowercase activation values and server-only
  marker names case-sensitively.
- **Prevention:** Keep response-leak assertions aligned to the exact forbidden
  literals rather than semantic word fragments.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun the focused Worker RED and confirm only the
  paid-AI enforcement regression remains.

## Verification and related work

The corrected focused Worker RED run retained the expected candidate
enforcement failure without the three warning-code false positives.
