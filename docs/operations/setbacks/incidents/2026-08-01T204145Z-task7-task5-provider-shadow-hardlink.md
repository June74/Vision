# SB-20260801-204145-task7-task5-provider-shadow-hardlink: Provider-shadow hard link was unavailable

- **Status:** closed
- **First observed:** 2026-08-01T20:41:45.8087849Z
- **Last observed:** 2026-08-01T20:54:09.1462226Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5
- **Environment:** Local Phase B worktree isolated self-test
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The self-test could not create the planned temporary hard link used to shadow the provider executable.

## Impact

Containment setup paused before the Task 5 RED. The provider driver remained untouched, no self-test dispatch ran, and no live/provider, network, secret, key, or deployment state changed.

## Reproduction conditions

Attempt to create the isolated provider-executable hard link inside the temporary self-test root on this environment.

## Safe evidence

The link operation reported an unavailable filesystem capability before any driver process was launched. No path, provider value, or raw error is recorded.

## Attempts and outcomes

- Hard-link shadow setup failed closed before RED.
- The contained fallback is a private executable copy whose bytes are verified against the source, combined with a guarded preload and a PATH that cannot reach the real provider executable.
- The executable copy, byte equality, closed PATH/current directory, preload activation, and provider-shadow recognition were proven. RED remained paused because provider arguments were not yet safely available at preload startup.
- The guarded command-entry containment proof then completed. The first contained RED attempt was invalid because a legacy stub marker persisted between invocations and sent the old polling implementation to its deadline; the driver remained untouched.
- Cleanup and per-invocation marker isolation were verified. A valid contained RED then produced 17 expected failures out of 18 cases before the driver implementation began.

## Cause classification

- **Confirmed cause:** The requested hard-link operation is unavailable in the current self-test environment, the first preload design runs before the complete provider argument vector is safely available, and a legacy stub marker was not isolated per invocation during the first contained RED attempt.
- **Hypotheses:** None remaining for containment.
- **Rejected hypotheses:** The RED or provider driver caused the failure; neither had run.
- **Known exclusions:** No provider command, external network call, secret access, private output, or source edit occurred.

## Correction and prevention

- **Correction:** The self-test now uses a byte-verified private executable copy, closed PATH/current directory, guarded private command entries, per-invocation marker isolation, stub proof, and unconditional temporary-root cleanup.
- **Prevention:** Preflight link capability before relying on it and retain a verified copy fallback that cannot fall through to the real executable.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Implement the approved Task 5 behavior against the valid contained RED.

## Verification and related work

Containment verification passed: cleanup and marker isolation were verified, the driver stayed untouched until a valid 17-of-18 failing RED, and no live/provider action occurred. Task 5 GREEN and review remain separate work.

## Recurrence history

- 2026-08-01T20:41:45.8087849Z: First observed and contained before RED.
- 2026-08-01T20:45:48.7825528Z: Copy/hash/PATH/preload containment was proven, but preload argument timing was insufficient; RED remained paused while the guarded command-entry fallback was prepared.
- 2026-08-01T20:49:37.2185896Z: Guarded command-entry containment passed, but the first RED attempt was invalidated by a persistent legacy marker and old-driver polling deadline; no driver or provider state changed.
- 2026-08-01T20:54:09.1462226Z: Cleanup and marker isolation passed; a valid contained 17-of-18 failing RED proved the harness and closed the containment incident before implementation.
