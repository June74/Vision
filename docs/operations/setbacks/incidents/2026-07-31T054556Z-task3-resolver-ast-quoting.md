# SB-20260731-054556-task3-resolver-ast-quoting: Resolver AST preflight was rejected by PowerShell quoting

- **Status:** closed
- **First observed:** 2026-07-31T05:45:56.2027559Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
- **Phase/task:** Phase B Task 3 resolver final-review repair
- **Environment:** Main Phase B worktree; delegated Windows PowerShell writer
- **Version/commit:** c5de12d plus controller-owned ledger changes

## Symptom

A count-only AST inspection command was rejected by local PowerShell quoting
before execution.

## Impact

The resolver RED tests and implementation did not begin. No source, test,
documentation, Git, provider, or external state changed.

## Reproduction conditions

Construct the unnecessary count-only AST helper as a complex inline PowerShell
command with incompatible quote nesting.

## Safe evidence

The writer returned one local parse-error category. The command did not
execute, and no source, URI, credential, protected identifier, provider value,
argument stream, or environment value was emitted.

## Attempts and outcomes

- PowerShell rejected the helper before execution.
- The writer stopped before any edit or test.

## Cause classification

- **Confirmed cause:** Inline quote nesting made the AST inspection command
  invalid PowerShell.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No resolver or test failure occurred.
- **Known exclusions:** No edit, test, stage, commit, provider action, or
  external mutation occurred.

## Correction and prevention

- **Correction:** Remove the AST-preflight step and work directly from the
  already identified exact resolver functions and contract.
- **Prevention:** Do not add complex inline parsing helpers when exact source
  locations and required RED cases are already known.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Subsequent diagnostics used direct bounded runners. The complete resolver lane
passed 66 tests, TypeScript, documentation coverage, and owned diff checks.

## Recurrence history

- 2026-07-31T05:45:56.2027559Z: First observed and contained before command
  execution or mutation.
- 2026-07-31T06:01:21.0518974Z: A later bounded in-memory failure classifier
  omitted one parenthesis and was also rejected before execution. No state
  changed beyond the already logged 64-of-66 resolver result. Further
  classification moves to the main process using a simpler direct runner.
- 2026-07-31T14:05:00.9419278Z: Closed after decoder-free, direct bounded
  verification completed the lane without another parse error.
