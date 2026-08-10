# SB-20260802-032013-task8-auth-trace-skill-path-lookups: Auth trace used incorrect skill roots

- **Status:** closed
- **First observed:** 2026-08-02T03:20:13.4599351Z
- **Last observed:** 2026-08-02T17:13:14.1009005Z
- **Phase/task:** Phase B Task 8 owner authentication diagnosis and reconnect-recovery Task 1 implementation
- **Environment:** Local read-only code trace
- **Version/commit:** `4420f6d`

## Symptom

The delegated read-only trace mixed two skill roots and made two local skill
file lookups that could not resolve.

## Impact

The trace was delayed briefly. No repository, application, account, or provider
state changed, and no private data was read or exposed.

## Reproduction conditions

Resolve a named skill by combining an entry from one catalog root with a
different root prefix.

## Safe evidence

Both local lookups failed before repository analysis began.

## Attempts and outcomes

- Two incorrect local skill paths failed to resolve.
- The main agent supplied the already-read workflow context and limited the
  delegate to the repository trace.
- A later Task 1 implementation read resolved `scope-gate` against the Codex
  skill root instead of its declared agent-skill root; the lookup was contained
  before any repository implementation edit.

## Cause classification

- **Confirmed cause:** Skill catalog roots were mixed during delegated setup.
- **Hypotheses:** None.
- **Rejected hypotheses:** The repository and requested source files were not
  missing.
- **Known exclusions:** No external request, provider action, or secret access
  occurred.

## Correction and prevention

- **Correction:** Continue from the parent-provided workflow context without
  repeating skill discovery.
- **Prevention:** Resolve each listed skill path against only its declared root;
  delegated read-only traces should not repeat skills already read by the main
  agent.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The delegated task resumed as a read-only repository trace with edits and
external operations still prohibited.

For the Task 1 recurrence, `scope-gate` was read successfully from its declared
agent-skill root, and worktree detection confirmed the intended linked worktree
at the requested base commit before implementation resumed.

## Recurrence history

- 2026-08-02T03:20:13.4599351Z: First observed; two failed local lookups were
  contained before repository analysis.
- 2026-08-02T03:28:54.9085762Z: Recurred when the main agent resolved
  `scope-gate` against the Codex-skill root instead of its declared agent-skill
  root. The combined read stopped without repository or provider effects. The
  exact catalog mappings were then used and all four required skill files were
  read successfully.
- 2026-08-02T04:59:42.5577297Z: Recurred during the continued Task 8 plan
  audit when `scope-gate` was again resolved against the Codex-skill root.
  The missing-file result was contained; the declared agent-skill root and
  required Codex tool reference were then read successfully. No repository or
  provider state changed.
- 2026-08-02T05:58:44.2597008Z: Recurred when the reconnect design continuation
  resolved `trace-live-call-path` against the Codex-skill root instead of its
  declared agent-skill root. The read-only lookup failed before analysis; no
  repository or external state changed, and the cataloged path was used next.
- 2026-08-02T07:08:50.7207654Z: Recurred at reconnect-recovery execution
  startup when `scope-gate` was again resolved against the Codex-skill root
  instead of its declared agent-skill root. The combined read failed before
  implementation; the catalog mapping was corrected, all required workflow
  skills and the Codex tool reference were read successfully, and no project
  or external state changed.
- 2026-08-02T16:56:37.7425607Z: Recurred when the setback logger's relative
  `scripts/new_setback.py` reference was first resolved under the repository
  ledger directory instead of the skill directory. The missing-path lookup
  changed nothing; the script was then resolved relative to `SKILL.md` and
  created the required incident normally.
- 2026-08-02T17:12:19.9303282Z: Recurred during reconnect-recovery Task 1
  implementation when `scope-gate` was resolved against the Codex-skill root
  instead of its declared agent-skill root. The combined read failed before any
  repository implementation edit and was contained for correction.
