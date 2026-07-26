# SB-20260726-210852-skill-loaded-after-status-announcement: Workflow skill was loaded after the status announcement

- **Status:** closed
- **First observed:** 2026-07-26T21:08:52.2324591Z
- **Last observed:** 2026-07-26T21:08:52.2324591Z
- **Phase/task:** Phase B blocked audit
- **Environment:** Codex continuation turn
- **Version/commit:** `47e6e53`

## Symptom

The continuation posted a status announcement immediately before reading the
required conversation-start workflow skill.

## Impact

The instruction order was wrong. No repository, provider, browser, secret, or
live application state changed before the skill was loaded.

## Reproduction conditions

Begin an automatic goal continuation with commentary before invoking the
conversation-start skill.

## Safe evidence

The turn sequence shows the commentary directly before the successful skill
read.

## Attempts and outcomes

- The skill was loaded completely before substantive project inspection.
- The ordering mistake was detected and logged before the blocked decision.

## Cause classification

- **Confirmed cause:** The continuation treated the progress announcement as
  exempt from the skill-before-response rule.
- **Hypotheses:** None.
- **Rejected hypotheses:** The skill was not missing or unreadable.
- **Known exclusions:** No external or project mutation preceded the skill
  read.

## Correction and prevention

- **Correction:** Loaded the required workflow before continuing the audit.
- **Prevention:** On every new continuation turn, perform skill selection and
  loading before commentary.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The skill was read in full before the repository and evidence documents were
used for the blocked decision.

## Recurrence history

- 2026-07-26T21:08:52.2324591Z: First observed and corrected.
