# SB-20260731-142902-task3-vitest-config-classifier-quoting: Vitest config classifier had invalid PowerShell quoting

- **Status:** closed
- **First observed:** 2026-07-31T14:29:02.7866420Z
- **Last observed:** 2026-07-31T14:31:18.1189588Z
- **Phase/task:** Phase B Task 3 canonical focused-run diagnosis
- **Environment:** Main Phase B worktree; read-only PowerShell classifier
- **Version/commit:** c5de12d plus unstaged controller and resolver repairs

## Symptom

A regular-expression command intended to print only Vitest project names had
invalid nested PowerShell quoting and failed during parsing.

## Impact

The focused-run routing diagnosis did not execute in that attempt.

## Reproduction conditions

Embed a quote-heavy regular expression in a double-quoted PowerShell command
without a parser-safe literal form.

## Safe evidence

The shell emitted only its parser category and no repository content. No
source, URI, credential, protected identifier, provider value, environment
value, file mutation, or external action occurred.

## Attempts and outcomes

- The command failed before file discovery or matching.
- Repository and external state remained unchanged.

## Cause classification

- **Confirmed cause:** Invalid nested quote construction in the diagnostic.
- **Hypotheses:** None remaining for this command failure.
- **Rejected hypotheses:** No Vitest configuration error was proven.
- **Known exclusions:** No command-side mutation occurred.

## Correction and prevention

- **Correction:** Use a parser-safe file-name inspection or existing validated
  package entry point without a quote-heavy regex.
- **Prevention:** Avoid nested regex literals in inline PowerShell when a
  structured or fixed-string inspection is sufficient.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Identify the validated project invocation with a
  quote-safe bounded read.

## Verification and related work

The already validated direct test entry point was identified without another
regex command. Its one-file and combined focused runs both passed.

## Recurrence history

- 2026-07-31T14:29:02.7866420Z: First observed and contained before execution.
- 2026-07-31T14:31:18.1189588Z: Closed after quote-free routing diagnosis and
  successful direct focused verification.
