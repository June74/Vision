# SB-20260727-004820-in-memory-github-secret-update-failed: In-memory GitHub secret update failed

- **Status:** closed
- **First observed:** 2026-07-27T00:48:20Z
- **Last observed:** 2026-07-27T00:49:45Z
- **Phase/task:** Phase B preview Cloudflare account correction
- **Environment:** Node child process and GitHub CLI
- **Version/commit:** `22c5dc0`

## Symptom

The GitHub CLI executable started from the browser-control process but returned
a nonzero exit while receiving the dashboard account value through standard
input.

## Impact

The GitHub preview account secret was not corrected by this attempt. No secret
value was printed or persisted to a file.

## Reproduction conditions

Spawn the GitHub CLI from the browser-control process and stream the in-memory
dashboard account value to the environment-secret command.

## Safe evidence

The executable availability probe passed, while the secret command returned
only a nonzero exit boolean.

## Attempts and outcomes

- `gh --version` completed successfully in the child process.
- The secret update returned nonzero without emitting captured content.

## Cause classification

- **Confirmed cause:** The browser-control child process could start the CLI
  but its outbound network was denied.
- **Hypotheses:** None.
- **Rejected hypotheses:** The GitHub executable itself is not missing.
- **Known exclusions:** No account identifier or credential was emitted.

## Correction and prevention

- **Correction:** Capture stderr internally and return only allowlisted cause
  booleans.
- **Prevention:** Probe both executable availability and authenticated network
  context before attempting in-memory provider mutations.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Classify auth, network, or command-shape failure
  without returning provider content.

## Verification and related work

The safe classifier identified network permission denial. A local-only child
process then wrote the host clipboard, and the normal authenticated shell
performed the GitHub update.

## Recurrence history

- 2026-07-27T00:48:20Z: First observed and investigating.
- 2026-07-27T00:49:45Z: Closed after classifying the network boundary and using
  the normal authenticated shell for the provider call.
