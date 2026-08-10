# SB-20260802-215809-setback-helper-relative-path-mismatch: Setback helper relative path was resolved from the repository

- **Status:** closed
- **First observed:** 2026-08-02T21:58:09.508338Z
- **Last observed:** 2026-08-03T16:56:43.0091714Z
- **Phase/task:** Phase B OAuth reconnect Task 5 setback maintenance
- **Environment:** Local Windows PowerShell and personal Codex skill catalog
- **Version/commit:** candidate `c1911f8`

## Symptom

The logger instruction named scripts/new_setback.py, but the first lookup incorrectly resolved it under the repository setback directory rather than the skill directory.

## Impact

One read-only lookup failed before the helper was found; no project or external state changed.

## Reproduction conditions

Resolve `scripts/new_setback.py` from the repository setback directory instead
of from the directory containing the active `SKILL.md`.

## Safe evidence

The first file lookup returned path-not-found. A bounded search of the selected
skill directory found exactly one helper path. No private data was involved.

## Attempts and outcomes

- The incorrect repository-relative lookup failed without changing state.
- The helper was located relative to the skill entrypoint and successfully
  created both required privacy-safe incidents.

## Cause classification

- **Confirmed cause:** The relative helper reference was resolved from the
  repository rather than from the selected skill directory.
- **Hypotheses:** None.
- **Rejected hypotheses:** The helper was not missing from the installed skill.
- **Known exclusions:** No source, Git metadata, provider, credential, key, or
  deployment state changed.

## Correction and prevention

- **Correction:** Resolve referenced skill resources relative to the directory
  containing `SKILL.md`.
- **Prevention:** Preserve the skill root when following relative script links.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The located helper ran twice with exit zero and created one indexed incident
per distinct cause.

## Recurrence history

- 2026-08-02T21:58:09.508338Z: First observed.
- 2026-08-02T21:58:18.6675488Z: Closed after resolving from the selected skill
  directory and successfully using the helper.
- 2026-08-03T16:56:43.0091714Z: Recurred when the helper was first invoked from
  the repository path. The failed lookup made no change; the helper was then
  resolved relative to the active skill directory and successfully created
  the new indexed native-capture incident. The recurrence is closed.
