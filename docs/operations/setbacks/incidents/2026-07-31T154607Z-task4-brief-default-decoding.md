# SB-20260731-154607-task4-brief-default-decoding: Task 4 brief used the wrong default text decoding

- **Status:** closed
- **First observed:** 2026-07-31T15:46:07.5136494Z
- **Last observed:** 2026-07-31T15:46:34.5606179Z
- **Phase/task:** Phase B Task 4 implementation preflight
- **Environment:** Windows PowerShell local documentation read
- **Version/commit:** 2a2b5f9

## Symptom

The default `Get-Content` decoding rendered UTF-8 punctuation in the Task 4
brief as mojibake.

## Impact

No edit or implementation decision was made from the malformed rendering. No
secret, provider data, protected identifier, external state, or network action
was involved.

## Cause classification

- **Confirmed cause:** Windows PowerShell selected a legacy default decoding
  for a UTF-8 Markdown file.
- **Hypotheses:** None remaining.
- **Known exclusions:** The repository file itself was not changed.

## Correction and prevention

- **Correction:** Reread the brief with explicit UTF-8 decoding before using
  it.
- **Prevention:** Use explicit UTF-8 for Phase B Markdown reads in this
  Windows PowerShell environment.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Confirm the exact title renders correctly under
  explicit UTF-8 and then close the incident.

## Recurrence history

- 2026-07-31T15:46:07.5136494Z: First observed and contained before Task 4
  implementation began.
- 2026-07-31T15:46:34.5606179Z: Closed after explicit UTF-8 decoding rendered
  the title and requirement text correctly.
