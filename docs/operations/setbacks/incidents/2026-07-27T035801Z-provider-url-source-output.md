# SB-20260727-035801-provider-url-source-output: Provider URL entered command output

- **Status:** closed
- **First observed:** 2026-07-27T03:58:01Z
- **Last observed:** 2026-07-30T20:02:49.5514598Z
- **Phase/task:** Phase B live-acceptance closure Task 1
- **Environment:** Local Phase B worktree
- **Version/commit:** `1d6ad12`; `d24e24d`; `c8879b2`; `6bd0e45`; `7d5ca8a`

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
  during restore work even when their contents are committed. Run future Git
  pushes with quiet output and verify the local/remote commit equality
  separately with boolean-only output.
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

The 2026-07-29 Task 7 recurrence was closed by a bounded three-file inspection
that emitted only file count, URL-literal match count, raw-value count, and a
pass category. It reported zero raw values.

The 2026-07-30 push recurrence was closed by a separate local/remote reference
comparison that emitted only `remote_matches_reviewed_head=True` and
`tracked_worktree_clean=True`.

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
- 2026-07-29T18:31:14Z: Recurred during Task 7 when a broad source-context
  inspection printed one repository-configured deployment URL. No credential,
  token, database value, account identifier, protected row, or provider action
  was involved. Raw source-context inspection of URL-bearing configuration
  stopped; remaining freeze evidence is limited to redacted summaries,
  booleans, counts, and exit statuses.
- 2026-07-30T03:03:09Z: Recurred when the successful reviewed-branch push used
  Git's default output, which printed the public repository location. No secret,
  token, database value, account identifier, callback value, protected row, or
  provider-service mutation was exposed. The push itself completed as intended.
  Future pushes use quiet output, followed by a separate boolean-only
  local/remote reference comparison.
- 2026-07-30T03:07:03.8217300Z: A read-only acceptance-order audit entered
  prior-run memory and rendered one previously recorded non-authenticated
  preview location. The lookup stopped immediately. No secret, token, provider
  identifier, email, repository content, or external state was accessed or
  changed. The audit was constrained to repository files afterward.
- 2026-07-30T04:44:15.1970641Z: Recurred when a broad source read used for
  live-acceptance plan mapping printed one checked-in callback location. The
  read stopped immediately. No credential, token, account identifier, database
  value, protected row, or provider action was involved. Remaining mapping uses
  redacted structure, bounded counts, function names, and line numbers only.
- 2026-07-30T04:53:23.7871797Z: A read-only AI planning subagent reported that
  one broad excerpt printed checked-in configuration literals. It contained no
  runtime credential, token, account identifier, database value, protected row,
  or provider action. The subagent stopped broad reads; controller mapping uses
  redacted structure and bounded output.
- 2026-07-30T19:07:00.8702538Z: A broad Task 1 source inspection printed
  checked-in deployment metadata, including a configured location and provider
  resource labels. It contained no credential, authorization material,
  database value, event content, protected row, or secret value. Broad reads
  stopped immediately; remaining inspection uses redacted structure, function
  names, booleans, counts, and line numbers.
- 2026-07-30T19:07:41.4123087Z: A subsequent broad unit-test read printed one
  synthetic database-shaped fixture. It was test-only and contained no real
  credential, account data, protected row, or provider state. Raw test-file
  output stopped; remaining reads redact URL-shaped strings before returning
  content.
- 2026-07-30T19:13:01.8044726Z: The Task 1 workflow redaction removed URLs and
  deployment fixture lines but missed source-controlled provider resource
  labels elsewhere in the file. It exposed no credential, live provider value,
  account data, or external state. Further workflow inspection is restricted
  to input keys, operation literals, step names, booleans, and counts.
- 2026-07-30T19:22:08.5552380Z: A focused workflow-test failure diff rendered
  the full checked-in workflow because one stale assertion targeted the whole
  document. It exposed source-controlled deployment metadata but no credential,
  authorization material, live provider value, account data, or external
  state. The stale whole-document assertion is updated before rerunning.
- 2026-07-30T19:26:43.5529645Z: A redacted reference-page read did not mask
  source-controlled resource names embedded in prose. It exposed no credential,
  authorization material, live provider value, account data, or external
  state. Documentation edits continue from known headings without further raw
  reference output.
- 2026-07-30T19:39:25.0693453Z: A broad Task 1 source read printed the
  checked-in OAuth redirect location while checking implementation structure.
  It exposed no secret, token, authorization code, email, database value,
  protected row, or live provider response, and changed no state. Further
  source inspection is restricted to targeted symbols and URL-redacted output.
- 2026-07-30T19:42:17.7914405Z: A read-only Task 3 brief-preparation agent
  performed a broad memory context search that returned a previously stored
  preview location and historical metadata. The agent stopped before reading
  task documents. No secret, token, provider identifier, environment value,
  raw log, file mutation, network request, or provider action occurred.
  Preparation resumes from exact repository files without rendering memory
  context.
- 2026-07-30T20:02:49.5514598Z: The final Task 1 reviewer requested numbered
  workflow context outside the already sanitized review package and the local
  read included unchanged source-controlled URL literals. The reviewer did not
  use or repeat them and paused immediately. No credential, token, account
  data, provider response, file mutation, or external action was involved.
  Re-review resumes from the sanitized package plus redacted or symbol-only
  checks.
