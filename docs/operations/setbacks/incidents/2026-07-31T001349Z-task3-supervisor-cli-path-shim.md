# SB-20260731-001349-task3-supervisor-cli-path-shim: Task 3 supervisor CLI success fixture used an invalid PATH shim

- **Status:** closed
- **First observed:** 2026-07-31T00:13:49.207258Z
- **Last observed:** 2026-07-31T00:13:49.207258Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final bounded repair
- **Environment:** Local Windows supervisor CLI test
- **Version/commit:** Final bounded repair working tree after `841bc01`

## Symptom

The new real-CLI success canary failed before its intended assertion because the fake executable was not resolvable through the test PATH shim.

## Impact

One RED fixture did not reach the supervisor success behavior; production files and external state were unchanged.

## Reproduction conditions

Spawn the real supervisor CLI while supplying a fake executable through a PATH
shim that this Windows process does not resolve as intended.

## Safe evidence

The failure occurred before the success assertion; the separate producer and
consumer failure CLI cases did execute.

## Attempts and outcomes

- The first success fixture failed executable lookup.
- The fixture will use the absolute fake executable path while preserving the
  real supervisor CLI entrypoint.

## Cause classification

- **Confirmed cause:** The test PATH shim did not provide a resolvable Windows
  executable.
- **Hypotheses:** None.
- **Rejected hypotheses:** The supervisor entrypoint and production process
  runner were reached successfully by the failure canaries.
- **Known exclusions:** No production file, provider, protected value, network,
  Git history, or external state changed.

## Correction and prevention

- **Correction:** Pass the absolute fake executable path in the success
  fixture.
- **Prevention:** Real-CLI tests on Windows must not rely on a PATH-only shim
  for generated executables.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected fixture must pass in the focused GREEN run.

## Recurrence history

- 2026-07-31T00:13:49.207258Z: First observed.
