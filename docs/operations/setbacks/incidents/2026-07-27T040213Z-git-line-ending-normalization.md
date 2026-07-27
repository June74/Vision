# SB-20260727-040213-git-line-ending-normalization: Git reported line-ending normalization

- **Status:** closed
- **First observed:** 2026-07-27T04:02:13Z
- **Last observed:** 2026-07-27T04:58:22Z
- **Phase/task:** Phase B restore Task 3 verification
- **Environment:** Local Phase B worktree
- **Version/commit:** `1d6ad12`

## Symptom

Git warned that line-feed working-copy content in edited setback documents
would be normalized to carriage-return plus line-feed on a later Git touch.

## Impact

The documentation and whitespace checks exited successfully. No semantic
content, provider state, or private value changed because of the warning.

## Reproduction conditions

Run a diff check after patching tracked Markdown files in a Windows checkout
whose Git automatic line-ending conversion is enabled.

## Safe evidence

Git reported LF index content and LF or mixed working-copy content for the
three tracked setback files. Repository configuration reported automatic
conversion enabled.

## Attempts and outcomes

- The initial documentation and whitespace checks both exited zero.
- A bounded end-of-line inspection confirmed the warning was normalization
  metadata rather than a content error.

## Cause classification

- **Confirmed cause:** Windows Git automatic line-ending conversion detected
  patched LF content in files whose working-copy form is normalized.
- **Hypotheses:** None.
- **Rejected hypotheses:** The warning did not report a failed diff or
  malformed documentation. Disabling automatic conversion for the check is
  not a valid workaround in this checkout because existing carriage returns
  are then interpreted as trailing whitespace.
- **Known exclusions:** No broad formatting rewrite, provider action, secret
  operation, or external write occurred.

## Correction and prevention

- **Correction:** Preserve the semantic patch and allow Git to store its normal
  LF index representation.
- **Prevention:** Treat this exact warning as non-blocking when the whitespace
  check exits zero; do not override automatic conversion for the check. Use
  bounded end-of-line inspection if its meaning changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The documentation validator and `git diff --check` both exited zero before
this incident was recorded.

## Recurrence history

- 2026-07-27T04:02:13Z: First observed and closed after bounded inspection.
- 2026-07-27T04:04:09Z: Recurred when a command-scoped conversion override
  made existing carriage returns appear as trailing whitespace. The override
  was rejected; no file was staged or committed.
- 2026-07-27T04:58:22Z: Recurred during the Task 3 final whitespace check.
  The check exited zero; the warning remained limited to expected Windows
  normalization metadata for edited text files.
