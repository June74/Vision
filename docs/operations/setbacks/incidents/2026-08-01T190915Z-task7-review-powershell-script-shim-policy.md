# SB-20260801-190915-task7-review-powershell-script-shim-policy: Task 2 reviewer selected a policy-blocked PowerShell shim

- **Status:** closed
- **First observed:** 2026-08-01T19:09:15.097636Z
- **Last observed:** 2026-08-01T19:09:22.2739215Z
- **Phase/task:** Phase B Task 7 correlation repair Task 2 final review
- **Environment:** Windows PowerShell in the isolated Phase B worktree
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The reviewer first selected the PowerShell package-manager script shim, which execution policy blocked before typecheck started.

## Impact

Review verification was delayed only; the Windows command shim then completed typecheck with zero diagnostics. No workspace, provider, live, or secret state changed.

## Reproduction conditions

Select the PowerShell script shim for the package manager in this restricted
shell instead of the approved Windows command shim.

## Safe evidence

- The policy block occurred before the compiler started.
- The equivalent Windows command shim completed canonical typecheck with zero
  diagnostics.

## Attempts and outcomes

- The first launcher stopped at execution policy.
- The reviewer used the repository-standard command shim and completed the
  required read-only verification.

## Cause classification

- **Confirmed cause:** The reviewer selected the policy-blocked script shim
  instead of the documented Windows command shim.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** No compiler, repository, or Task 2 defect caused the
  launcher failure.
- **Known exclusions:** No file edit, provider, network, secret, calendar,
  database, R2, deployment, workflow, backup-key, staging, or commit action
  occurred.

## Correction and prevention

- **Correction:** Use the `.cmd` command shim in Windows PowerShell.
- **Prevention:** Reviewer briefs and prompts must name the exact Windows
  command shim and forbid implicit package-manager launcher selection.
- **Owner:** Codex.
- **Next diagnostic step:** None; the canonical typecheck result is complete.

## Verification and related work

Closed because the command-shim retry completed typecheck with zero diagnostics
and the policy-blocked attempt made no workspace or external change.

## Recurrence history

- 2026-08-01T19:09:15.097636Z: First observed.
