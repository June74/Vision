# SB-20260727-185543-retained-restore-target-relation-missing: Selected restore SQL context lacked a required relation

- **Status:** closed
- **First observed:** 2026-07-27T18:55:43Z
- **Last observed:** 2026-07-27T19:00:19Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `9bbc4be`

## Symptom

The read-only retained-target attestation query failed with PostgreSQL's fixed
missing-relation category.

## Impact

Target identity and emptiness were not accepted. Temporary Worker secrets were
not recreated, no restore deployment occurred, and no database write ran.

## Reproduction conditions

Run the exact copied-back read-only attestation query in the currently selected
SQL context.

## Safe evidence

The editor returned the PostgreSQL missing-relation category and SQLSTATE only.
The relation name, branch label, database URL, target identity, and query body
were not recorded.

## Attempts and outcomes

- The exact editor buffer was verified before execution.
- Button execution did not surface a result; the supported keyboard run exposed
  the fixed failure category.
- The next query checks only relation existence through PostgreSQL metadata.

## Cause classification

- **Confirmed cause:** At least one relation required by the attestation query
  is absent from the currently selected SQL context.
- **Hypotheses:** The SQL editor may have reset to the primary branch, or the
  retained disposable branch may no longer contain its full migration-9
  schema.
- **Rejected hypotheses:** The query did execute; the earlier absence of a
  visible result was not proof that Run had succeeded.
- **Known exclusions:** No mutation, secret creation, restore deployment, or
  protected-row read occurred.

## Correction and prevention

- **Correction:** Prove the selected branch and relation-existence counts using
  closed metadata-only evidence before any secret or deployment action.
- **Prevention:** Reconfirm the branch selector after every SQL-editor
  navigation and require a relation-existence preflight before row counts.
- **Owner:** Codex.
- **Next diagnostic step:** Run the fixed metadata-only relation preflight.

## Verification and related work

The metadata preflight proved all 29 authoritative relations were present and
only the operator-owned attestation was absent. Re-provisioning that table
returned a commit signal; the independent target check then returned the fixed
ready marker with no SQL error.

## Recurrence history

- 2026-07-27T18:55:43Z: First observed and contained before external changes.
- 2026-07-27T19:00:19Z: Closed after the missing operator-owned attestation was
  restored and the complete target boundary passed.
