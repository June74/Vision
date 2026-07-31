# SB-20260730-210806-task3-role-probe-regex-syntax: Task 3 role-probe RED test had invalid Unicode regex syntax

- **Status:** closed
- **First observed:** 2026-07-30T21:08:06.481816Z
- **Last observed:** 2026-07-30T21:09:56.9202896Z
- **Phase/task:** Phase B live-acceptance closure Task 3 RED gate
- **Environment:** Local Task 3 test-only RED run
- **Version/commit:** Uncommitted Task 3 tests based on `24e959f`

## Symptom

A new role-probe structural test used an unescaped literal brace in a Unicode regular expression, so its suite collected zero tests.

## Impact

The first 19-file RED gate is not accepted and implementation remains paused; no production file or external state changed.

## Reproduction conditions

Compile the new role-probe structural assertion under Unicode regular
expression mode with an unescaped literal closing brace.

## Safe evidence

One of nineteen suites collected zero tests with the constant syntax category
`Lone quantifier brackets`; other Task 3 failures reached the intended
missing-export/behavior boundaries.

## Attempts and outcomes

- The initial RED command was rejected because one suite failed during test
  parsing rather than for an expected product reason.

## Cause classification

- **Confirmed cause:** The test author omitted the escape for a literal brace
  in a Unicode-mode regex.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production TypeScript or runtime behavior caused
  the collection failure.
- **Known exclusions:** No production file, provider, private-data, or external
  state changed.

## Correction and prevention

- **Correction:** Escape the literal brace in the test-only expression and
  rerun all nineteen suites.
- **Prevention:** New structural regex assertions must first compile and collect
  their suite before their RED result is accepted.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

After the test-only escape correction, all nineteen suites collected. The RED
gate reported sixteen failed and three passed files, with 60 failed and 313
passed tests; every remaining failure matched a planned missing Task 3 export
or old behavior.

## Recurrence history

- 2026-07-30T21:08:06.481816Z: First observed.
- 2026-07-30T21:09:56.9202896Z: Corrected full-scope RED collected and failed
  only at planned product boundaries; incident closed.
