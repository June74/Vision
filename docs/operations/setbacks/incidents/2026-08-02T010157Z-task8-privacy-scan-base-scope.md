# Task 8 privacy scan used the authoring base instead of the candidate base

- **Occurred:** 2026-08-02T01:01:57Z
- **Status:** closed
- **Phase:** Phase B / tracked correlation repair / Task 8 exact-diff freeze
- **Category:** verification scope error

## What happened

The first pre-freeze privacy diagnostic compared the working tree with the older plan-authoring commit. That mixed already-committed historical work into the uncommitted candidate and made its match counts invalid. A repository-wide log count was also broader than the candidate-residue question.

## Impact

No file, provider, deployment, credential, or live state was changed by the diagnostic. Its nonzero counts are not evidence of a candidate privacy problem and must not be used for admission.

## Corrective action

- Rerun the added-line scan against `HEAD`, including only tracked changes plus non-ignored untracked candidate files.
- Check candidate log residue through Git status instead of scanning unrelated repository history.
- Accept only aggregate category counts; never print matched content.

## Prevention

State the intended comparison boundary before every freeze diagnostic: use the authoring commit for frozen-history invariants, and use `HEAD` for the exact uncommitted candidate.

## Closure

The corrected `HEAD`-bounded scan covered tracked additions and all non-ignored untracked candidate files. It found zero URL, email, literal 64-hex, long-decimal, and candidate log-file matches.
