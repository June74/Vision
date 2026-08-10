# SB-20260728-214956-powershell-markdown-backtick-escaped-ledger: PowerShell escaped Markdown backtick in ledger

- **Status:** closed
- **First observed:** 2026-07-28T21:49:56.608574Z
- **Last observed:** 2026-08-03T00:20:55.8304816Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 progress bookkeeping
- **Environment:** Local Phase B worktree
- **Version/commit:** `fb49bd0`

## Symptom

PowerShell interpreted the Markdown backtick before a commit identifier as an escape and wrote a control character into the ignored progress ledger.

## Impact

The ignored progress line displayed the commit identifier incorrectly; no tracked source, Git commit, provider, database, R2, deployment, secret, or key state changed.

## Reproduction conditions

Append Markdown containing a backtick-delimited commit identifier through a
double-quoted PowerShell string.

## Safe evidence

The last nonblank ledger line contained a form-feed control character before
the shortened commit text instead of a literal opening backtick.

## Attempts and outcomes

1. Replaced the exact control-character sequence with the intended literal
   Markdown text using a single-quoted replacement.
2. The first verification falsely failed because it selected a trailing blank
   line.
3. A second verification selected the last nonblank line and confirmed the
   exact literal `fb49bd0` formatting.

## Cause classification

- **Confirmed cause:** PowerShell treats the backtick as its escape character
  inside double-quoted strings; backtick plus `f` produced form feed.
- **Hypotheses:** None.
- **Rejected hypotheses:** The correction itself had not failed; only the
  first trailing-blank-line verifier was wrong.
- **Known exclusions:** No tracked source, Git commit, provider, database, R2,
  deployment, secret, or key state changed.

## Correction and prevention

- **Correction:** Store Markdown backticks through single-quoted PowerShell
  literals and verify the last nonblank line.
- **Prevention:** Never place Markdown code delimiters in PowerShell
  double-quoted write strings.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The ignored progress ledger now contains the exact literal commit identifier
and preserves the Task 3 pending-manifest gate.

## Recurrence history

- 2026-07-28T21:49:56.608574Z: First observed.
- 2026-08-03T00:19:57.5166030Z: Recurred in the ignored corrected-redeploy
  controller when a Markdown-backtick evidence pattern was placed in a
  double-quoted PowerShell string. The parser rejected the script with four
  cascading syntax errors before any local validation, provider query, or
  deployment. Replace only that pattern with a single-quoted literal and
  rerun the syntax gate.
- 2026-08-03T00:20:55.8304816Z: Closed after the single-quoted pattern
  correction reduced the complete controller parser result to zero errors.
