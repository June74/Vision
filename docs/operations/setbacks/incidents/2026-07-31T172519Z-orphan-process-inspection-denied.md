# SB-20260731-172519-orphan-process-inspection-denied: Windows denied command-line process inspection

- **Status:** closed
- **First observed:** 2026-07-31T17:25:19.4888984Z
- **Last observed:** 2026-07-31T17:25:19.4888984Z
- **Phase/task:** Phase B Task 3 fourth-wave repair integration
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
