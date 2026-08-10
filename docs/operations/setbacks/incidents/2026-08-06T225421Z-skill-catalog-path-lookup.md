# SB-20260806-225421-skill-catalog-path-lookup: Skill catalog path lookup used wrong catalog root during guarded deployment preparation

- **Status:** closed
- **First observed:** 2026-08-06T22:54:21.391847Z
- **Last observed:** 2026-08-10T22:48:50Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A procedural file lookup used the primary skill catalog root for a skill stored in the secondary catalog; the helper lookup also started from the linked worktree instead of the repository-global skill directory.

## Impact

No product, provider, database, calendar, credential, or secret state changed; preparation paused briefly while safe paths were resolved.

## Reproduction conditions

The first skill read used the primary catalog path for a skill that is installed in the secondary catalog. The first setback-helper invocation also assumed the helper lived under the linked worktree. Both failures were local path-resolution errors during preparation.

## Safe evidence

The safe command results were: the secondary skill path was resolved from the available skill catalog; the helper was located under the global setback-logger skill directory; the helper completed and created this incident; no provider or application command ran during the path lookup. Do not paste private or secret values.

## Attempts and outcomes

1. Read from the primary catalog path: failed with a local file-not-found result; no state change.
2. Ran the helper relative to the worktree: failed with a local file-not-found result; no state change.
3. Located the helper with a bounded local file search and reran it by absolute path: created this incident successfully.

## Cause classification

- **Confirmed cause:** Catalogs are split between the primary and secondary skill roots, and the setback helper is installed with the skill rather than in the project checkout.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The project checkout was not missing its own setback documentation; the repository state was not changed by either failed lookup.
- **Known exclusions:** No provider authentication, deployment, database, calendar, AI gateway, secret, or key operation was attempted.

## Correction and prevention

- **Correction:** Read the skill from its catalog-specific root and invoke the helper with its absolute global path and an explicit project root.
- **Prevention:** Resolve skill paths from the catalog table before reading; when a helper is referenced by a skill, check the skill directory before the project tree and use a bounded search only if necessary.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful helper-created incident and the bounded local path-resolution checks above. No provider-facing action was performed during this setback.

## Recurrence history

- 2026-08-06T22:54:21.391847Z: First observed.
- 2026-08-10T22:48:50Z: Recurred when the scope-gate skill was first sought
  under the primary `.codex` catalog root instead of the listed `.agents`
  root. The failed read changed no project or provider state; the correct
  catalog-specific path was used immediately afterward.
