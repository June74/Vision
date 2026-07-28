# SB-20260727-035801-provider-url-source-output: Provider URL entered command output

- **Status:** closed
- **First observed:** 2026-07-27T03:58:01Z
- **Last observed:** 2026-07-28T15:00:32Z
- **Phase/task:** Phase B production-environment protection audit
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
- **Project-owner disposition:** The standing owner instruction is to record
  every setback in this ledger and continue Phase B. This historical
  source-controlled, non-secret URL exposure is accepted as contained under
  that instruction; this is not permission to repeat or broaden the output.
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
- 2026-07-27T04:43:35Z: Recurred when an otherwise test-only patch included
  two existing URL-bearing test lines as context. The patch succeeded, but no
  credential, restore value, account identifier, OAuth value, or provider
  action was involved. All remaining edits and evidence use URL-independent
  anchors plus bounded boolean, count, or line-number output.
- 2026-07-27T05:08:21Z: Recurred when the unsanitized Task 3 review package
  included URL-bearing diff context and was circulated to the independent
  reviewer. It contained source-controlled endpoint text but no credential
  or provider-private value. The package is retired and replaced by a
  zero-context, scheme-sanitized package. Closed under the project owner's
  standing log-and-continue disposition for recorded setbacks.
- 2026-07-27T17:29:26Z: Recurred when the successful immutable-candidate
  workflow dispatch returned its provider run link to command output. It
  contained no token, credential, database value, account identifier, OAuth
  value, or protected row. Remaining GitHub operations must suppress default
  output and return only run number, commit, status, conclusion, and safe
  deployment identifiers.
- 2026-07-28T14:36:07Z: Recurred when a read-only audit subagent inspected an
  older memory excerpt that contained the public preview address. The value
  appeared only in private tool output and was not a callback URL, credential,
  token, account identifier, database value, or protected row. The agent was
  instructed to stop memory inspection, use repository-relative sources only,
  and verify its report contains no URL or provider identifier.
- 2026-07-28T14:49:26Z: Recurred when the read-only cleanup-boundary audit used
  one broad local configuration read that returned a repository-configured
  URL. Broad configuration output stopped immediately; later inspection used
  targeted tracked-file queries and redaction. No credential, token, database
  value, account identifier, protected row, or provider action was involved.
- 2026-07-28T15:00:32Z: Recurred when the GitHub API returned its standard
  documentation link alongside a read-only environment lookup failure despite
  a bounded field selector. The response contained no credential, token,
  database value, account identifier, protected row, or environment details.
  Later diagnostics suppress raw provider error bodies and return only status
  categories.
