# SB-20260727-001121-github-workflow-dispatch-network-sandbox: GitHub workflow dispatch was blocked by the network sandbox

- **Status:** closed
- **First observed:** 2026-07-27T00:11:21Z
- **Last observed:** 2026-07-27T23:29:53Z
- **Phase/task:** Phase B listener-first restore retry Task 2
- **Environment:** Local PowerShell and GitHub CLI
- **Version/commit:** `ac1f044`

## Symptom

The guarded preview workflow dispatch could not connect to the GitHub API from
the default sandbox.

## Impact

The workflow was not created. No GitHub, Cloudflare, application, or database
state changed.

## Reproduction conditions

Dispatch the GitHub workflow from the restricted local network context.

## Safe evidence

The client reported a local socket-permission failure before receiving a
provider response.

## Attempts and outcomes

- The default network attempt failed before dispatch.
- The same fixed command is retried through the approved external-network path.

## Cause classification

- **Confirmed cause:** The local execution sandbox denied the outbound GitHub
  connection.
- **Hypotheses:** None.
- **Rejected hypotheses:** This does not indicate a GitHub workflow or token
  failure.
- **Known exclusions:** No secret or provider response body was printed.

## Correction and prevention

- **Correction:** Use the explicit external-network approval for guarded GitHub
  operator commands.
- **Prevention:** Treat local socket-denied errors as sandbox boundaries before
  changing workflow code or credentials.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Retry the exact dispatch command externally.

## Verification and related work

The external retry created and completed the isolated workflow job. Its
provider-stage failure was independent of the local network sandbox.

## Recurrence history

- 2026-07-27T00:11:21Z: First observed and contained.
- 2026-07-27T00:13:05Z: Closed after the same fixed dispatch succeeded through
  the approved external-network path.
- 2026-07-27T17:28:39Z: Recurred when the immutable restore-candidate workflow
  dispatch used the default network sandbox. The connection was denied before
  GitHub received the request, so no workflow or provider state was created.
  The exact fixed dispatch must use the external-network path.
- 2026-07-27T23:29:53Z: Recurred when the documentation-amendment push ran
  after the preceding commit had already been blocked by the linked-worktree
  metadata boundary. The default network sandbox could not reach GitHub; no
  commit existed to push and no remote state changed. The fixed explicit-path
  commit and push must use the established scoped metadata and external-network
  path.
