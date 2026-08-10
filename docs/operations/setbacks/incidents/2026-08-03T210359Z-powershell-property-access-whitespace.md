# SB-20260803-210359-powershell-property-access-whitespace: PowerShell status query used invalid property-access spacing

- **Status:** closed
- **First observed:** 2026-08-03T21:03:59.241373Z
- **Last observed:** 2026-08-03T21:04:21.0987759Z
- **Phase/task:** Phase B candidate authentication diagnosis
- **Environment:** Windows PowerShell 5.1 local read-only documentation query
- **Version/commit:** diagnostic only; no product or provider change

## Symptom

A read-only INDEX status-summary command failed with a PowerShell parser error because the expression contained whitespace between the pipeline variable and its Line property.

## Impact

No file, Git, provider, deployment, credential, or external state changed; the diagnostic query had to be corrected.

## Reproduction conditions

Place whitespace between PowerShell's pipeline variable and its `.Line`
property inside a `ForEach-Object` script block.

## Safe evidence

PowerShell rejected the command during parsing with an unexpected-token error.
No command body ran and no private value was read or emitted.

## Attempts and outcomes

The malformed summary query failed once. A corrected query used `$match.Line`
and returned only aggregate incident-status counts.

## Cause classification

- **Confirmed cause:** A typing error inserted invalid whitespace into the
  property-access expression.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** INDEX corruption or incompatible PowerShell syntax.
- **Known exclusions:** No file, Git, provider, deployment, credential, or
  external state changed.

## Correction and prevention

- **Correction:** Use direct property access without whitespace.
- **Prevention:** Keep small PowerShell pipeline expressions syntactically
  simple and validate them before adding unrelated processing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected read-only query completed successfully and emitted only aggregate
status counts.

## Recurrence history

- 2026-08-03T21:03:59.241373Z: First observed.
- 2026-08-03T21:04:21.0987759Z: Corrected query verified; incident closed.
