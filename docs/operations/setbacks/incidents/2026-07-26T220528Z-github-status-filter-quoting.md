# SB-20260726-220528-github-status-filter-quoting: GitHub status filter quoting failed

- **Status:** closed
- **First observed:** 2026-07-26T22:05:28Z
- **Last observed:** 2026-07-27T02:00:11Z
- **Phase/task:** Phase B temporary backup deployment
- **Environment:** Local PowerShell GitHub CLI
- **Version/commit:** `cab6d4d`

## Symptom

The first compact workflow-status command used a jq expression whose nested
quotes were altered by PowerShell, so GitHub CLI rejected the expression.

## Impact

The already-dispatched workflow continued normally. Only the first status read
failed.

## Reproduction conditions

Pass a quote-heavy jq concatenation expression through PowerShell without
PowerShell-safe escaping.

## Safe evidence

GitHub CLI reported a parse error before making the status output.

## Attempts and outcomes

- The jq-filtered status read failed.
- A scalar built-in template succeeded.
- A later multiline built-in template also failed at the PowerShell quoting
  boundary.
- The replacement for collections uses a simple field-only jq projection.

## Cause classification

- **Confirmed cause:** Cross-shell quoting changed the jq expression.
- **Rejected hypotheses:** None.
- **Known exclusions:** No workflow, repository, Cloudflare, or database state
  was changed.

## Correction and prevention

- **Correction:** Use `--template` for fixed scalar workflow status output.
- **Prevention:** Avoid jq string concatenation in PowerShell GitHub CLI calls.
- **Owner:** Codex.

## Verification and related work

Closed because the failed command was read-only and the replacement avoids the
quoting boundary.

## Recurrence history

- 2026-07-26T22:05:28Z: First occurrence.
- 2026-07-26T22:06:00Z: Recurred with a multiline template while identifying
  the failed job; the workflow remained unchanged.
- 2026-07-27T02:00:11Z: Recurred when a job-name comparison with spaces was
  passed through PowerShell to jq. Parsing failed before a status result; the
  workflow remained unchanged. The replacement omits the string filter and
  returns only fixed job status fields.
