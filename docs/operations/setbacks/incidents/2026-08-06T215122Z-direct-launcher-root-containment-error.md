# SB-20260806-215122-direct-launcher-root-containment-error: Launcher rejected its exact worktree root

- **Status:** closed
- **First observed:** 2026-08-06T21:51:22.2801925Z
- **Last observed:** 2026-08-06T21:58:34.0614582Z
- **Phase/task:** Phase B direct candidate-launcher repair
- **Environment:** Local Windows PowerShell no-provider TDD GREEN run
- **Version/commit:** ignored operational launcher; no application or provider mutation

## Symptom

The launcher applied a descendant-only containment check to the exact
`WorktreeRoot` value, so a valid root equal to the containment base was
rejected as `direct_launcher_path_escape`.

## Impact

The local GREEN fixture stopped before child launch. No live controller,
provider, schedule, binding, secret, or deployment action ran.

## Reproduction conditions

Pass the exact worktree root as the launcher root while the containment helper
requires `base\child` rather than allowing `base` itself.

## Safe evidence

Only the safe category `direct_launcher_path_escape` was emitted. No raw output
or private value was exposed.

## Attempts and outcomes

- Parser passed after the quote correction.
- The behavior test exposed the root-boundary defect.
- The correction resolves the root directly and applies containment only to
  descendants such as `.superpowers\sdd` and its logs.

## Cause classification

- **Confirmed cause:** Root equality was not a valid case in the descendant
  containment helper.
- **Hypotheses:** None.
- **Rejected hypotheses:** The fixture path or process API was not malformed.
- **Known exclusions:** No network, provider, application, credential, key,
  schedule, deployment, Git, or tracked-file state changed.

## Correction and prevention

- **Correction:** Resolve the supplied root as an existing path, then enforce
  descendant containment for all generated operational paths.
- **Prevention:** Test both exact-root resolution and nested path containment.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun parser and the complete direct-launcher
  no-provider contract.

## Verification and related work

The corrected root handling passed parser validation and the direct-launcher
contract, including a fixture whose root and generated paths contain spaces.
The complete local gate set also passed; no provider-facing process was
started.

## Recurrence history

- 2026-08-06T21:51:22.2801925Z: First observed and contained before launch.
- 2026-08-06T21:52:19.8761819Z: Recurred when the containment helper's
  `MustExist` switch was accidentally declared mandatory for generated log
  paths. The parser passed but the local test stopped before child launch; no
  external state changed.
- 2026-08-06T21:58:34.0614582Z: Closed after corrected root and descendant
  containment passed the no-provider contract.
