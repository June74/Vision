# SB-20260803-192853-ignored-controller-subagent-review-conflict: Ignored controller files conflict with commit-based subagent review

- **Status:** closed
- **First observed:** 2026-08-03T19:28:53.191901Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter repair preflight
- **Environment:** Local Windows review workflow
- **Version/commit:** Ignored operational artifacts; no provider mutation

## Symptom

The approved plan prohibits force-adding .superpowers operational files, while the selected subagent-driven workflow normally requires a task commit and Git diff package for review.

## Impact

No implementation has started; the owner must choose between preserving ignore scope with a snapshot diff review or expanding repository scope by tracking the operational controller files.

## Reproduction conditions

Review the ignored operational artifacts through sanitized snapshot/focused
contract evidence without force-adding them to the repository.

## Safe evidence

The ignored controller and launcher remained untracked, while bounded local
contracts and independent review evidence passed. No private value or provider
response was emitted.

## Attempts and outcomes

- The operational artifacts stayed ignored as required.
- Review used sanitized snapshot and behavior evidence instead of a forced
  commit of `.superpowers` files.

## Cause classification

- **Confirmed cause:** Commit-based review was incompatible with the approved
  ignore boundary for operational helper files.
- **Hypotheses:** None.
- **Rejected hypotheses:** Tracking or force-adding the helpers was not needed.
- **Known exclusions:** No product, provider, credential, or key state changed.

## Correction and prevention

- **Correction:** Keep helpers ignored and review them through sanitized,
  bounded local contracts and snapshot packages.
- **Prevention:** Do not force-add `.superpowers` operational files solely to
  satisfy a commit-oriented review workflow.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the direct launcher and native controller
  contracts remain green.

## Verification and related work

Closed by the later sanitized review packages and provider-free contract gates.

## Recurrence history

- 2026-08-03T19:28:53.191901Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after ignored-artifact review and local
  contract evidence passed without expanding tracking scope.
