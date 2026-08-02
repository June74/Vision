# SB-20260731-154658-review-wait-below-minimum: Review wait used an unsupported interval

- **Status:** closed
- **First observed:** 2026-07-31T15:46:58.0380923Z
- **Last observed:** 2026-08-02T01:06:53.3487113Z
- **Phase/task:** Phase B Task 3 review and Task 8 exact-tip review
- **Environment:** Multi-agent orchestration
- **Version/commit:** 2a2b5f9

## Symptom

The first review-wait request used 1,000 milliseconds while the orchestration
tool requires at least 10,000 milliseconds.

## Impact

The request was rejected before waiting. Review agents remained running and no
file, provider, network, secret, or external state was affected.

## Cause classification

- **Confirmed cause:** The caller supplied a value below the documented tool
  minimum.
- **Hypotheses:** None remaining.
- **Known exclusions:** No agent was interrupted or restarted.

## Correction and prevention

- **Correction:** Use a wait interval of at least 10,000 milliseconds.
- **Prevention:** Keep orchestration waits within the documented range.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the corrected call is deterministic.

## Recurrence history

- 2026-07-31T15:46:58.0380923Z: First observed and closed after correcting the
  next wait interval.
- 2026-08-02T01:06:53.3487113Z: Recurred during the Task 8 exact-tip review;
  the rejected request affected no review or repository state, and the next
  wait uses the documented minimum.
