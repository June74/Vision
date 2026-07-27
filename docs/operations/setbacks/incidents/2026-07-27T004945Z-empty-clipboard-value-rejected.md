# SB-20260727-004945-empty-clipboard-value-rejected: Empty clipboard value was rejected

- **Status:** closed
- **First observed:** 2026-07-27T00:49:45Z
- **Last observed:** 2026-07-27T00:49:45Z
- **Phase/task:** Phase B preview Cloudflare account correction
- **Environment:** Local Windows PowerShell
- **Version/commit:** `22c5dc0`

## Symptom

This PowerShell clipboard implementation rejected an empty string during the
cleanup step after the GitHub secret update.

## Impact

The command returned nonzero after the GitHub update, and the sensitive value
could have remained on the host clipboard briefly.

## Reproduction conditions

Invoke `Set-Clipboard` with an empty string in this PowerShell runtime.

## Safe evidence

PowerShell reported only that the clipboard value could not be null. The
clipboard content itself was never read into output.

## Attempts and outcomes

- Empty-string cleanup failed.
- The clipboard was immediately overwritten with a harmless fixed marker.
- The named GitHub secret showed a recent update timestamp.

## Cause classification

- **Confirmed cause:** The local `Set-Clipboard` implementation treats an empty
  string as an invalid null value.
- **Hypotheses:** None.
- **Rejected hypotheses:** The GitHub secret update did not fail before the
  cleanup step.
- **Known exclusions:** No account identifier was printed.

## Correction and prevention

- **Correction:** Overwrite with a harmless nonempty marker.
- **Prevention:** Use a fixed nonsecret marker for clipboard cleanup on this
  PowerShell version.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The overwrite command exited zero, and the secret metadata showed a recent
update.

## Recurrence history

- 2026-07-27T00:49:45Z: First observed, contained, and closed.
