# SB-20260730-195338-task7-brief-case-insensitive-redaction: Task 7 brief sanitizer over-redacted case-insensitive text

- **Status:** closed
- **First observed:** 2026-07-30T19:53:38.711370Z
- **Last observed:** 2026-07-30T19:54:43.5848229Z
- **Phase/task:** Phase B live-acceptance closure Task 7 brief preparation
- **Environment:** Local Windows PowerShell, read-only brief preparation
- **Version/commit:** `6bd0e450885b3c3aa38f3ba38289e1371b3cbb43`

## Symptom

A read-only PowerShell sanitization pass over-redacted ordinary prose because the replacement operator matched case-insensitively.

## Impact

The unusable sanitized pass was discarded and brief preparation paused; no file or external state changed and no protected value was emitted.

## Reproduction conditions

Apply PowerShell's default case-insensitive replacement operator to a
case-sensitive sanitization pattern across ordinary document prose.

## Safe evidence

The agent detected that the sanitized result had changed unrelated prose,
discarded it, and stopped before using it. The already captured Task 7 and
global-constraint facts remain sufficient for a content-free brief.

## Attempts and outcomes

- The generic sanitization pass produced an unusable in-memory result.
- No sanitized text was treated as authoritative and no file was written.

## Cause classification

- **Confirmed cause:** PowerShell `-replace` performs case-insensitive matching
  unless the case-sensitive form is requested.
- **Hypotheses:** None.
- **Rejected hypotheses:** The source documents were not corrupted; only an
  in-memory derivative was affected.
- **Known exclusions:** No protected value was emitted, and no file, provider,
  network, remote ref, or external state changed.

## Correction and prevention

- **Correction:** Discard the derivative and complete the brief from already
  captured safe facts without another broad sanitization pass.
- **Prevention:** Use exact extraction or explicitly case-sensitive,
  narrowly scoped replacement only; never trust a broad sanitized derivative
  without a structural integrity check.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The agent completed the Task 7 execution brief from already captured safe facts
without relying on the discarded derivative or rendering another broad source
extract.

## Recurrence history

- 2026-07-30T19:53:38.711370Z: First observed.
