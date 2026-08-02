# SB-20260801-175921-task7-sdd-helper-portability: Task 7 SDD helper portability mismatch

- **Status:** closed
- **First observed:** 2026-08-01T17:59:21.725291Z
- **Last observed:** 2026-08-01T18:02:09.1843438Z
- **Phase/task:** Phase B Task 7 correlation repair
- **Environment:** Windows PowerShell, repository worktree, bundled SDD and setback-logger skills
- **Version/commit:** `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The standard task-brief helper could not run because awk was unavailable; rg.exe also could not launch, and the initially documented repository-local setback helper path did not exist.

## Impact

Only local preparation was delayed. No tracked repair source, provider, secret, calendar, database, R2, deployment, workflow, or backup-key state changed.

## Reproduction conditions

Invoke the bundled Bash task-brief helper from PowerShell in this Windows
environment, attempt the preferred `rg` search, and then look for the setback
helper at the repository-local path described by the skill workflow.

## Safe evidence

- The task-brief helper stopped before extraction because its `awk` dependency
  was unavailable in the selected Bash environment.
- PowerShell could not launch the available `rg.exe` application alias.
- The repository-local setback helper path was absent; the installed skill owns
  the helper under its own `scripts` directory.
- The replacement bounded Task 1 brief passed a 79-line structural check with
  its exact heading and required-report section present.

## Attempts and outcomes

- The standard task-brief helper failed without modifying tracked repair files.
- The preferred `rg` lookup failed without reading repository content.
- The initially inferred repository-local logger path failed closed.
- The installed skill helper successfully created this incident.
- A bounded manual task brief was created with `apply_patch` and validated.

## Cause classification

- **Confirmed cause:** The selected Bash environment did not expose the helper's
  required `awk`; this PowerShell session could not launch the `rg.exe` alias;
  and the logger helper resides in the installed skill rather than the
  repository.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** No defect in the approved correlation-repair plan or
  repository source caused these preparation failures.
- **Known exclusions:** No provider, network, Git mutation, credential,
  calendar, database, R2, deployment, workflow, backup-key, or tracked repair
  source state changed.

## Correction and prevention

- **Correction:** Use the installed setback helper by exact path, PowerShell
  `Select-String` for bounded searches, and an `apply_patch`-created bounded task
  brief when the Bash helper prerequisites are unavailable.
- **Prevention:** Check helper prerequisites before dispatch, never infer the
  logger location, and keep every fallback constrained to known files or
  directories.
- **Owner:** Codex.
- **Next diagnostic step:** Dispatch the isolated Task 1 implementer from the
  validated brief.

## Verification and related work

Closed after the replacement Task 1 brief reported 79 lines, the exact Task 1
heading, and the required report contract. No sensitive value shape was copied
into the incident or brief.

## Recurrence history

- 2026-08-01T17:59:21.725291Z: First observed.
- 2026-08-01T18:02:09.1843438Z: The isolated Task 1 implementer stopped
  before TDD when PowerShell again failed to launch `rg.exe`. No search process
  started, and only the ignored safe status report was written. No repair
  source, provider, secret, calendar, database, R2, deployment, workflow, or
  backup-key state changed. The retry must use bounded PowerShell reads without
  `rg`.
