# SB-20260728-150032-github-production-environment-lookup-404: GitHub production environment lookup returned 404

- **Status:** closed
- **First observed:** 2026-07-28T15:00:32Z
- **Last observed:** 2026-07-28T15:04:00Z
- **Phase/task:** Phase B production-environment protection audit
- **Environment:** Read-only GitHub API from the local Phase B worktree
- **Version/commit:** `4817d6c`

## Symptom

A read-only lookup for the repository's production deployment environment
returned HTTP status 404 instead of the requested fixed-shape protection
booleans and counts.

## Impact

The check did not establish whether the environment is absent or the current
token cannot view it. No GitHub, repository, deployment, provider, credential,
database, R2, restore, or key state changed.

## Reproduction conditions

Query the production environment through the current authenticated GitHub CLI
session while requesting only protection-rule counts and branch-policy
booleans.

## Safe evidence

The provider returned only a not-found category and standard documentation
metadata. It returned no environment configuration, account identifier,
credential, token, deployment value, or protection details.

## Attempts and outcomes

- The first exact environment lookup returned 404.
- No environment creation, update, deletion, or permission workaround was
  attempted.

## Cause classification

- **Confirmed cause:** The production environment does not exist. A signed-in
  read-only settings-page check showed the environment page, its creation
  control, two visible environment entries, and no production entry.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The repository context was wrong; a bounded
  case-insensitive repository check matched the intended repository. The
  signed-in browser lacked environment visibility; it displayed the
  environment settings page and two existing entries.
- **Known exclusions:** The response does not prove that protections are
  configured or absent.

## Correction and prevention

- **Correction:** Classified the API result against the authoritative signed-in
  settings page and recorded the environment as absent.
- **Prevention:** Resolve repository identity and list-visible environment
  count before requesting one named environment. Suppress raw provider error
  bodies and emit only status categories.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Obtain action-time approval before creating or
  changing the production environment and its deployment protections.

## Verification and related work

The intended repository matched, the settings page was authenticated and
visible, two environment entries were counted, and no production entry was
present. No setting was changed.

## Recurrence history

- 2026-07-28T15:00:32Z: First observed and contained without mutation.
- 2026-07-28T15:04:00Z: Closed after the signed-in settings page confirmed the
  production environment is absent while other environment entries are
  visible. No creation or permission change was attempted.
