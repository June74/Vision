# SB-20260729-031129-ai-action-literal-drift: AI printer test guessed the terminal action literal

- **Status:** closed
- **First observed:** 2026-07-29T03:11:29Z
- **Last observed:** 2026-07-29T03:11:29Z
- **Phase/task:** Acceptance instrumentation Task 4 final re-review tests
- **Environment:** Windows PowerShell, isolated phase-b-foundation worktree
- **Version/commit:** `ad4cd938772c4a9333b474b96e9aa08cf1db691d`

## Symptom

The new AI-only printer characterization reached its fixed fallback instead of
emitting the otherwise canonical AI evidence record.

## Impact

One test failed for a setup mistake and delayed verification. Production code,
provider state, credentials, and private data were unaffected.

## Reproduction conditions

Construct an AI terminal test record with a manually guessed action string
instead of the producer's exported action constant.

## Safe evidence

- The focused classifier tests accepted the same canonical evidence.
- A content-free comparison showed that the test literal did not equal the
  exported producer action.
- Reconstructing the record with the exported action classified successfully.

## Attempts and outcomes

- The first printer characterization used the guessed literal and fell back.
- A read-only producer-to-classifier diagnostic isolated the action mismatch.

## Cause classification

- **Confirmed cause:** The test duplicated and guessed the producer action
  instead of importing its exported constant.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The shared terminal registry and AI evidence
  classifier were not the cause; direct classification with the exported
  action succeeded.
- **Known exclusions:** No product behavior, external system, or private value
  caused the failure.

## Correction and prevention

- **Correction:** Import and use `PHASE_B_AI_USAGE_ACTION` in the printer test.
- **Prevention:** Reuse exported action and evidence discriminators in tests;
  do not restate cross-module protocol literals.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused printer and classifier tests are rerun after replacing the literal
with the exported constant.

## Recurrence history

- 2026-07-29T03:11:29Z: First observed and contained.
