# SB-20260731-185558-windows-cmd-wrapper-teardown-hang: Windows command wrapper did not settle its child during teardown

- **Status:** open
- **First observed:** 2026-07-31T18:55:58.7433742Z
- **Last observed:** 2026-07-31T19:02:56.0011548Z
- **Phase/task:** Phase B Task 3 fifth-review Windows supervisor repair
- **Environment:** Local focused Vitest process
- **Version/commit:** 7dc954b plus in-progress isolated repairs

## Symptom

The RED case reproduced the real Windows command-script launch failure. A
provisional trusted `cmd.exe` wrapper then launched successfully, but producer
teardown targeted the wrapper and did not settle the spawned fake producer, so
the focused test hung until only the local Vitest process was terminated.

## Impact

The provisional Windows source/test changes are not green and cannot be
integrated. No workflow, documentation, provider, network, environment,
secret, staging, or commit was changed by the stopped lane.

## Cause classification

- **Confirmed cause:** Introducing a command-interpreter wrapper changed the
  process-tree ownership seen by the existing termination/close contract. The
  intentionally broken RED fixture also retains an untracked inherited process
  or stream handle after killing its recorded outer and producer trees.
- **Hypotheses:** The residual RED-only handle may belong to the consumer or an
  intermediate wrapper stream chain.
- **Known exclusions:** The original ten injected-executable tests passed, and
  the hang occurred only after the new default Windows branch launched.

## Correction and prevention

- **Correction:** Trace the exact parent/child handles and select a trusted
  Windows launch method whose started process can be terminated and awaited
  without untrusted shell interpolation. Add a bounded teardown assertion
  before accepting the implementation.
- **Prevention:** Treat launch success and process-tree teardown as one Windows
  contract; never validate the wrapper launch in isolation.
- **Owner:** Codex.
- **Next diagnostic step:** Implement the already-traced production tree-first
  termination and require the fixed path to pass a bounded end-to-end test;
  do not require the intentionally broken pre-fix fixture to self-clean.

## Recurrence history

- 2026-07-31T18:55:58.7433742Z: Observed and contained by terminating only the
  local focused test process.
- 2026-07-31T18:59:07.5503751Z: Recurred after a five-second watchdog used a
  trusted test-only `taskkill.exe` tree cleanup; the outer close wait still did
  not settle, so only the focused Vitest process was terminated and production
  termination remained unchanged.
- 2026-07-31T19:02:56.0011548Z: Recurred after the RED fixture recorded and
  terminated both the outer supervisor and fake producer trees; another
  inherited handle remained. The RED failure is accepted as reproduced, but
  only the repaired production path may be used for bounded GREEN evidence.
