# SB-20260731-145905-restore-repair-tooling-setbacks: Restore repair hit discovery, wait-schema, and ledger-context errors

- **Status:** closed
- **First observed:** 2026-07-31T14:59:05.6148391Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 restore-input bounds repair
- **Environment:** Delegated repair and controller-owned setback logging
- **Version/commit:** 73191b7 plus unstaged setback records

## Symptom

The restore lane hit the known Windows `rg` access failure, then used one wrong
wait-field name and one below-minimum wait duration while stopped. The
controller's first attempt to record these events also used stale context from
an existing incident and failed exact patch verification.

## Impact

The restore repair remains paused before edits. The first combined ledger
patch made no changes, so this exact incident replaces that failed update.

## Reproduction conditions

Use `rg` in the affected Windows environment, call the collaboration wait tool
with an invalid field or duration, or update an older incident using inferred
recurrence text rather than exact current context.

## Safe evidence

Only fixed access, schema, bound, and patch-context categories were returned.
No source payload, URI, credential, protected identifier, provider value,
runtime stream, environment value, repository source change, or external
action occurred.

## Attempts and outcomes

- File discovery stopped at the known `rg` failure.
- Both invalid wait calls were rejected before waiting.
- The failed ledger patch was atomic and changed no file.

## Cause classification

- **Confirmed cause:** Incompatible discovery tooling, invalid wait inputs,
  and stale patch context.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No provider, permission, or source-code blocker is
  implicated.
- **Known exclusions:** Restore implementation files remain unchanged.

## Correction and prevention

- **Correction:** Resume with bounded PowerShell discovery, use the exact wait
  schema only when needed, and use new incident files when older context is not
  known exactly.
- **Prevention:** Apply the documented Windows `rg` fallback and never infer
  ledger recurrence anchors.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Resume the original strict-TDD restore bounds lane.

## Verification and related work

The restore repair completed 38 focused tests, TypeScript, documentation,
security evidence, security scan, owned diff, combined focused, and full
repository verification without another discovery/wait/context failure.

## Recurrence history

- 2026-07-31T14:59:05.6148391Z: Restore discovery and two wait calls were
  contained before repair edits.
- 2026-07-31T14:59:47.6410820Z: The first ledger update failed exact context
  verification and was replaced by this standalone record.
- 2026-07-31T15:04:28.7228901Z: A later read-only search across the ignored
  process-artifact tree exceeded its command timeout and was terminated. Only
  truncated repository paths were emitted; no protected/provider data,
  mutation, or external action occurred. Recursive process-tree searches are
  now prohibited for this lane.
- 2026-07-31T15:30:50.5669463Z: Closed after the bounded exact-path workflow
  completed all restore and integration gates.
