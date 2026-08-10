# SB-20260731-172519-orphan-process-inspection-denied: Windows denied command-line process inspection

- **Status:** closed
- **First observed:** 2026-07-31T17:25:19.4888984Z
- **Last observed:** 2026-08-10T18:31:00Z
- **Phase/task:** Phase B Task 3 through corrected redeploy read-only validation diagnostics
- **Environment:** Local Windows sandbox process diagnosis
- **Version/commit:** 752b81f plus unstaged repair

## Symptom

Windows denied CIM process-command-line inspection, so the emitted zero match
count was invalid and could not prove whether the interrupted check survived.

## Impact

No process was terminated and no file, provider, network, secret, or external
state changed. The complete repository gate remains unproved.

## Cause classification

- **Confirmed cause:** The managed sandbox does not permit the requested CIM
  process inspection.
- **Hypotheses:** None about active processes are accepted from the invalid
  count.
- **Known exclusions:** No destructive process action was attempted.

## Correction and prevention

- **Correction:** Start a new uniquely wrapped check without relying on global
  process enumeration or termination.
- **Prevention:** Treat output accompanied by a permission error as invalid,
  even when the shell also emits a plausible aggregate value.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the uniquely wrapped complete gate and trust
  only its own process exit code.

## Recurrence history

- 2026-07-31T17:25:19.4888984Z: First observed and closed by abandoning the
  invalid process-count result.
- 2026-08-02T18:20:16.4651935Z: Recurred after a synthetic diagnostic process
  timed out and a CIM command-line query was used to look for a survivor. The
  sandbox denied enumeration, so the reported zero count was discarded. No
  process was terminated; the corrected file-based reproducer completed under
  its own authoritative exit code.
- 2026-08-03T19:04:29.4027038Z: Recurred after the hidden read-only controller
  launcher omitted its run summary. CIM denied the narrow process query, so its
  zero count was discarded. Uniquely named result files independently proved
  the controller had exited safely; no process action or external mutation was
  attempted.
- 2026-08-03T21:25:23.6971358Z: Recurred while checking for another candidate
  controller after a self-matching launch guard. The sandbox denied CIM before
  producing a valid count, so the result was discarded. The unique active-run
  state file remained the authority; no process or provider action resulted
  from the failed query.
- 2026-08-10T18:31:00Z: Recurred while checking whether an old controller process was still
  present before the final approved retry. Windows denied CIM command-line
  inspection before any result was usable; no process action or provider
  mutation occurred.
