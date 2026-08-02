# Task 7 Task 6 independent review findings

- **Occurred:** 2026-08-01T23:32:59.9228423Z
- **Status:** closed
- **Resolved:** 2026-08-01T23:45:00.5562759Z
- **Phase:** Phase B / tracked correlation repair / Task 6 independent review
- **Category:** security contract review findings
- **Review verdict:** FAIL
- **Severity counts:** Critical 0, Important 2, Minor 0

## What happened

The fresh read-only review of the exact frozen Task 6 driver and self-test found two Important concurrency and lifecycle gaps.

1. Lease selection and atomic claim did not preserve the complete approval identity. Post-claim validation checked schema, nonce, tuple, and current expiry but did not prove every selected approval field was unchanged across the rename boundary.
2. Expired-control cleanup validated a pathname and later deleted that pathname without atomically claiming it first. It also did not validate every semantic invariant, so a concurrent replacement or semantically invalid exact-schema record could be deleted.

The reviewer reported zero Critical and zero Minor findings. No live state was accessed and no tests or mutations were performed by the reviewer.

## Impact

Task 6 is not accepted. The first frozen snapshot is retained as failed evidence and cannot be used for Task 7 integration or Task 8 re-admission.

## Corrective action

- Add an adversarial lease-substitution test proving full canonical approval identity is preserved across atomic claim.
- Compare every post-claim lease field to the exact pre-claim lease before creating an action request.
- Add cleanup tests for concurrent replacement and semantically invalid records.
- Redesign cleanup to atomically claim an already validated candidate, re-read and revalidate the claimed record through the bounded one-handle path, and delete only when the full identity and every semantic invariant still match.
- Preserve nonmatching, malformed, changed, or unexpired records without broad deletion.
- Rerun 86/86 plus the added adversarial coverage, syntax, privacy, and default-root non-mutation gates; then create a new exact freeze and obtain a fresh 0/0/0 review.

## Prevention

Any state transition that authorizes or deletes must bind the complete record across its atomic claim boundary. Exact key shape alone is not equivalent to semantic validity or identity continuity.

## Resolution

Three deterministic adversarial assertions were added: complete lease-identity substitution, semantically invalid cleanup preservation, and cleanup replacement during atomic claim. The driver now compares every lease field across claim, and cleanup atomically claims, fully revalidates, compares, and preserves any changed record before failing closed. The expanded suite passed 89/89. A new exact v2 freeze had zero byte mismatches and received a fresh PASS with Critical 0, Important 0, and Minor 0.
