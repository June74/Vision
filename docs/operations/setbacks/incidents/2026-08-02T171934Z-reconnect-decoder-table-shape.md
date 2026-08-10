# SB-20260802-171934-reconnect-decoder-table-shape: Reconnect decoder table expanded row arrays

- **Status:** closed
- **First observed:** 2026-08-02T17:19:34.143041Z
- **Last observed:** 2026-08-02T17:20:51.0906212Z
- **Phase/task:** Phase B reconnect-recovery Task 1 contract GREEN
- **Environment:** Local Vitest 4.1 contract project
- **Version/commit:** `94b8810` plus uncommitted Task 1 changes

## Symptom

Vitest expanded each decoder row array into callback arguments instead of passing one iterable row value.

## Impact

Three new decoder cases stopped before the production decoder assertion; the SQL contract and all existing OAuth contracts passed.

## Reproduction conditions

Use `it.each` with array-valued table rows and a callback that expects each
entire row array as one parameter.

## Safe evidence

The focused contract run reported three failures with the safe runtime message
`rows is not iterable`; the SQL contract and 13 existing cases passed.

## Attempts and outcomes

- The first focused contract run passed 13 cases and failed only the three new
  closed-decoder rows before repository execution.

## Cause classification

- **Confirmed cause:** Vitest expands array-valued table rows into callback
  arguments, so the table needs one additional outer tuple layer.
- **Hypotheses:** None.
- **Rejected hypotheses:** The repository decoder did not emit the wrong error;
  the test failed while spreading its callback input.
- **Known exclusions:** No provider, external service, real database, or private
  data was involved.

## Correction and prevention

- **Correction:** Wrap each intended decoder row array in one outer tuple.
- **Prevention:** For Vitest table tests whose case value is itself an array,
  explicitly wrap that value so `it.each` supplies one callback argument.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

After adding the outer tuple layer, the fresh focused OAuth contract project
passed all 16 tests, including all three closed-decoder cases.

## Recurrence history

- 2026-08-02T17:19:34.143041Z: First observed.
