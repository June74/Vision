# SB-20260731-170852-candidate-doc-patch-context: Candidate documentation patch missed current wrapping

- **Status:** closed
- **First observed:** 2026-07-31T17:08:52.6540721Z
- **Last observed:** 2026-07-31T17:10:58.4744248Z
- **Phase/task:** Phase B Task 3 fourth-wave candidate lifecycle repair
- **Environment:** Local reference-document update
- **Version/commit:** 752b81f plus unstaged candidate repair

## Symptom

A multi-file documentation patch expected a paragraph with different current
line wrapping and failed verification atomically.

## Impact

The failed patch changed no file and did not affect implementation, provider,
network, environment, secret, protected output, or external state.

## Cause classification

- **Confirmed cause:** One documentation hunk used stale wrapping context.
- **Hypotheses:** None remaining.
- **Known exclusions:** No partial documentation mutation occurred.

## Correction and prevention

- **Correction:** Apply one exact current-context patch per documentation file.
- **Prevention:** Inspect the bounded target paragraph immediately before
  multi-line reference edits.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T17:08:52.6540721Z: First observed and closed with the per-file
  patch fallback.
- 2026-07-31T17:09:33.5510311Z: Recurred on the technical reference because
  its target sentence wrapped differently than the per-file assumption. The
  patch made no change; the next edit uses the exact displayed lines.
- 2026-07-31T17:10:38.2276604Z: Recurred when a combined lifecycle-reference
  patch omitted the Markdown heading marker from one expected context. No
  change occurred. Further documentation edits use one inspected exact block
  per patch with no combined hunks.
- 2026-07-31T17:10:58.4744248Z: Recurred independently in the controller
  envelope lane: a combined simple/technical reference patch matched one file
  but not the other's wrapping and applied nothing atomically. Controller code
  and tests remained green at 59 of 59. That lane must also use exact bounded
  per-file documentation patches.
