# SB-20260727-040611-client-runtime-binding-classification: Temporary runtime secrets were outside the runtime classification

- **Status:** contained
- **First observed:** 2026-07-27T04:06:11Z
- **Last observed:** 2026-07-27T04:06:11Z
- **Phase/task:** Phase B restore Task 3
- **Environment:** Local Phase B worktree
- **Version/commit:** `1d6ad12`

## Symptom

The pre-edit client secret-bundle test reported one failure because the
exhaustive runtime-binding classification omitted both temporary restore
runtime entries.

## Impact

Seventeen tests passed and one classification test failed. Both entries are
already in the complete client denylist, so the release scanner remains
fail-closed for their names, but the narrower runtime inventory is incomplete.

## Reproduction conditions

Run the focused secret-bundle test at the Task 3 base before modifying any
candidate file.

## Safe evidence

The assertion compared 19 classified runtime entries with 21 environment
schema entries. The only missing entries were the two documented temporary
restore secret names; no values were printed or inspected.

## Attempts and outcomes

- The clean focused baseline reproduced the single deterministic failure.
- Work stopped before Task 3 candidate edits because the minimal policy-source
  correction is outside the brief's exact file list.

## Cause classification

- **Confirmed cause:** The temporary fields were added to the environment
  schema and complete client denylist but not the runtime-forbidden inventory.
- **Hypotheses:** The Task 3 file list may have omitted the policy-source file.
- **Rejected hypotheses:** The temporary secret names are not absent from the
  complete client denylist.
- **Known exclusions:** No secret value, provider state, deployment,
  credential change, or workflow mutation occurred.

## Correction and prevention

- **Correction:** Pending controller confirmation of the permitted file scope.
- **Prevention:** Keep the runtime schema exhaustiveness assertion and update
  the runtime classification in the same change as future environment fields.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Resolve whether the existing policy-source file may
  be included in Task 3.

## Verification and related work

Focused result: 17 passed and 1 failed before Task 3 candidate edits.

## Recurrence history

- 2026-07-27T04:06:11Z: First observed and contained pending scope resolution.
