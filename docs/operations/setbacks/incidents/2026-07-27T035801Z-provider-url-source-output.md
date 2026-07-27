# SB-20260727-035801-provider-url-source-output: Raw source inspection emitted provider URL literals

- **Status:** closed
- **First observed:** 2026-07-27T03:58:01Z
- **Last observed:** 2026-07-27T04:06:24Z
- **Phase/task:** Phase B restore Task 3
- **Environment:** Local Phase B worktree
- **Version/commit:** `1d6ad12`

## Symptom

A read-only command printed complete workflow and release-scanner source files,
including provider-controlled URL literals that the Task 3 brief excludes from
logs.

## Impact

The output contained repository literals but no secret value, token, account
identifier, database URL, restore target value, branch identifier, object key,
OAuth value, protected row, or provider action. The prohibited URL literals
cannot be removed from existing tool output.

## Reproduction conditions

Print complete source files that include allowlisted provider endpoint
literals instead of returning only bounded boolean or line-number evidence.

## Safe evidence

The command was read-only and returned source-controlled text. No provider was
accessed and no external state changed.

## Attempts and outcomes

- The overly broad read completed and exposed more source text than Task 3
  required.
- Further raw reads of URL-bearing files were stopped.

## Cause classification

- **Confirmed cause:** Inspection output was not bounded against the brief's
  provider-URL logging prohibition.
- **Hypotheses:** None.
- **Rejected hypotheses:** No credential or provider-private value was read.
- **Known exclusions:** No deployment, secret configuration, rotation,
  provider inspection, or workflow mutation occurred.

## Correction and prevention

- **Correction:** Use exact path checks that emit only booleans, counts, and
  line numbers for remaining policy inspection.
- **Prevention:** Treat URL-bearing source files as sensitive-output surfaces
  during restore work even when their contents are committed.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The follow-up inspection returned only redacted identifiers, booleans, counts,
and line numbers. It confirmed the required workflow-policy and client-boundary
interfaces without emitting URL contents.

## Recurrence history

- 2026-07-27T03:58:01Z: First observed and contained.
- 2026-07-27T04:06:24Z: Recurred during controller inspection of the release
  scanner while resolving the Task 3 security-scope ambiguity. The read was
  stopped after source-controlled endpoint literals appeared; it exposed no
  credential or provider-private value and changed no state.
