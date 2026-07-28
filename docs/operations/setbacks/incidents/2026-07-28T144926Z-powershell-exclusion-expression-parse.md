# SB-20260728-144926-powershell-exclusion-expression-parse: PowerShell exclusion expression did not parse

- **Status:** closed
- **First observed:** 2026-07-28T14:49:26Z
- **Last observed:** 2026-07-28T14:49:26Z
- **Phase/task:** Phase B temporary cleanup boundary audit
- **Environment:** Local Windows linked worktree
- **Version/commit:** `22a1e55`

## Symptom

A read-only cleanup inventory used a malformed PowerShell exclusion
expression. PowerShell rejected the expression with parser errors before the
intended source comparison ran.

## Impact

The cleanup audit was delayed while the inventory was rewritten. No source,
Git, provider, secret, database, R2, deployment, restore, or key state changed.

## Reproduction conditions

Construct a compound exclusion expression in a PowerShell command without
first reducing it to a supported simple predicate or exact path list.

## Safe evidence

The parser stopped before the affected read-only comparison. The audit already
had the immutable commit ancestry and later completed its inventory through
targeted diffs and exact tracked-file queries.

## Attempts and outcomes

- The malformed inspection expression failed before execution.
- Targeted exact-path comparisons replaced the compound expression and
  completed the cleanup audit.

## Cause classification

- **Confirmed cause:** The command used a PowerShell exclusion expression that
  was not valid for the installed parser.
- **Hypotheses:** None.
- **Rejected hypotheses:** The audited commits and files were not missing.
- **Known exclusions:** No private value was emitted and no mutation occurred.

## Correction and prevention

- **Correction:** Replaced the compound exclusion with exact tracked-file
  queries and targeted diffs.
- **Prevention:** For bounded repository audits, enumerate exact paths first
  and avoid composing exclusion predicates inline.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The ignored cleanup-boundary audit report completed with an exact file
inventory, dependency order, verification commands, and a privacy-safe
provider-cleanup boundary.

## Recurrence history

- 2026-07-28T14:49:26Z: First observed, contained, corrected, and closed.
