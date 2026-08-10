# SB-20260802-002332-task7-rg-launch-failure: Task 7 bounded search could not launch rg

- **Status:** contained
- **First observed:** 2026-08-02T00:23:32Z
- **Last observed:** 2026-08-06T22:06:53.5654009Z
- **Phase/task:** Phase B tracked-correlation repair, reconnect-recovery audit, and corrected redeploy preparation
- **Environment:** Local Windows PowerShell worktree
- **Version/commit:** Published Task 7 candidate

## Symptom

A bounded read-only repository search could not launch the bundled `rg.exe` because this Windows session reported that no application was associated with the executable.

No project state, provider state, secret, or live environment was changed.

## Impact

The intended search produced no results and the paired source read did not run because the orchestration cell stopped on the first failed command. The failure does not affect product code or evidence already collected.

## Reproduction conditions

Launch the bundled search executable in this Windows session, where the host
reports no associated application for that executable.

## Safe evidence

The launch failed before repository content was searched. Later bounded native
PowerShell fallbacks returned only safe match counts or status facts.

## Attempts and outcomes

- Repeated bundled-search launches failed before reading project content.
- Bounded `Select-String` and `Get-Content` fallbacks succeeded.

## Cause classification

- **Confirmed cause:** This Windows session cannot launch the bundled search
  executable through its current application association.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The repository paths and target content were not
  missing.
- **Known exclusions:** No project, provider, secret, credential, calendar,
  database, object-storage, deployment, or key state changed.

## Correction and prevention

- **Correction:** Use bounded `Select-String` and `Get-Content` reads.
- **Prevention:** Treat the bundled search executable as unavailable on this
  host and keep diagnostic reads independent.
- **Owner:** Codex.
- **Next diagnostic step:** Continue using exact native PowerShell paths.

## Verification and related work

The native PowerShell fallback completed successfully and preserved only safe
counts or status facts.

## Recurrence history

- 2026-08-02T00:28:32Z: The read-only integration reviewer encountered the same local launch failure before reading project content. The reviewer made no changes and switched to bounded PowerShell search. The review was then stopped for a separate moving-target repair.

- 2026-08-02T01:12:19.1512532Z: The exact-tip reviewer encountered the same local launch restriction while listing ignored review artifacts. No project or protected state was accessed or changed. The review was stopped before verdict and will restart with native PowerShell discovery only.

- 2026-08-02T02:25:36.2950586Z: The Phase B status refresh encountered the same local launch restriction while searching the memory registry. No project, provider, or protected state was changed. The refresh switched to native PowerShell search and continued successfully.

- 2026-08-02T02:48:40.7650305Z: The bounded Task 8 readiness auditor encountered the same `rg.exe` application-association launch failure before assessing the runbook. The auditor stopped without a workaround, external access, or tracked edit. A bounded native PowerShell lookup then succeeded and preserved only a match count, verifying the fallback without exposing memory content.

- 2026-08-02T05:42:06.7001385Z: The read-only reconnect-recovery reviewer
  encountered the same launch restriction during repository-instruction
  discovery. No file or external state changed. The reviewer switched to
  native PowerShell and continued with only repository-relative source facts.

- 2026-08-02T22:58:28.1718576Z: Rollback-evidence maintenance encountered
  the same `rg.exe` launch restriction while looking for an existing incident.
  No project or provider state changed. Exact-path `Get-Content` and bounded
  `Select-String` are now the only search methods for this acceptance lane.

- 2026-08-03T17:26:50.8524265Z: Corrected redeploy preparation encountered
  the same launch restriction while locating the schedule challenge/proof
  workflow. No project or provider state changed; the read-only search resumed
  with bounded `Select-String`.

- 2026-08-06T22:06:53.5654009Z: Phase B completion audit encountered the
  same launch restriction before searching the current evidence. No project,
  provider, or protected state changed; the audit switched to bounded native
  PowerShell reads.
