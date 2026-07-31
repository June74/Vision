# SB-20260731-165639-local-read-command-quoting: Candidate lane malformed a read-only redaction command

- **Status:** closed
- **First observed:** 2026-07-31T16:56:39.1651967Z
- **Last observed:** 2026-07-31T16:56:39.1651967Z
- **Phase/task:** Phase B Task 3 fourth-wave candidate lifecycle repair
- **Environment:** Local bounded source inspection
- **Version/commit:** 752b81f plus concurrent ledger updates

## Symptom

A JavaScript wrapper string used invalid quoting for a read-only PowerShell
URL-redaction command, so the command failed before execution.

## Impact

No file, provider, network, environment, secret, protected output, or external
state was read or changed by the failed command.

## Cause classification

- **Confirmed cause:** Nested quote delimiters were not escaped consistently.
- **Hypotheses:** None remaining.
- **Known exclusions:** No shell command executed.

## Correction and prevention

- **Correction:** Use a simpler quoting form and retain the URL-redaction
  boundary.
- **Prevention:** Avoid nested wrapper quoting for simple bounded reads.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T16:56:39.1651967Z: First observed and closed after selecting the
  simpler quoting form.
