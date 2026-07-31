# SB-20260731-020512-task3-controller-red-classifier-mismatch: Task 3 controller RED classifier missed the runner wording

- **Status:** closed
- **First observed:** 2026-07-31T02:05:12.336008Z
- **Last observed:** 2026-07-31T03:59:01.8377261Z
- **Phase/task:** Phase B Task 3 controller full-file regression diagnosis
- **Environment:** Isolated controller-hardening worktree; focused Vitest RED run
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus one controller RED test

## Symptom

The first new controller test failed, but the sanitized classifier did not recognize the runner rejection wording needed to prove the intended missing-reconciliation RED cause.

## Impact

RED verification paused before production edits; only the new test exists and no provider, live, protected, or external state changed.

## Reproduction conditions

Run the first uncertain-dispatch reconciliation RED test and classify captured
runner output with a pattern set that does not include the runner's exact safe
rejection wording.

## Safe evidence

The test process exited nonzero and the classifier returned only
`unclassified`; no runner stream, URI, identifier, protected value, or source
text was emitted.

## Attempts and outcomes

- The RED test failed before any production edit, as expected.
- The initial classifier could not prove that the failure was the intended
  missing-reconciliation assertion.
- A later encoded-count classifier did not match Vitest's numeric wording and
  returned unknown sentinels for both requested counts.
- The first post-signal contradiction RED classifier could not distinguish an
  intended fulfilled-versus-rejected failure from fixture timing or type
  setup.

## Cause classification

- **Confirmed cause:** The one-off sanitized classifier was narrower than the
  focused runner's stable safe rejection wording.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No production edit, provider action, network request,
  protected value, live request, or external state was involved.

## Correction and prevention

- **Correction:** Run the single test once with a boolean-only diagnostic that
  checks the intended assertion/recovery category without rendering streams.
- **Prevention:** Validate a RED classifier against the focused runner's safe
  category vocabulary before relying on it for a new group. For small finite
  numeric domains, assert each candidate as a boolean rather than parsing
  runner prose.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The boolean-only rerun confirmed the test failed on the intended
resolve-versus-reject assertion. Only the controller's constant public failure
was observed; the injected source error was not exposed, and there was no
reference or type failure.

## Recurrence history

- 2026-07-31T02:05:12.336008Z: First observed.
- 2026-07-31T02:06:27.6118790Z: Closed after boolean-only diagnosis confirmed
  the intended missing-reconciliation RED cause without rendering captured
  streams.
- 2026-07-31T02:29:59.7584971Z: Recurred during no-signal diagnosis when a
  regex did not match Vitest's numeric wording, returning unknown sentinels
  instead of raw output. One temporary encoded assertion remains; the retry
  probes only finite boolean count possibilities.
- 2026-07-31T02:33:45.7354742Z: Closed after finite boolean probes established
  exact 1/1 rollback and observer-read counts without parsing runner prose.
  The temporary diagnostic block was removed and the focused test passed.
- 2026-07-31T02:34:30.6751996Z: Reopened when the post-signal contradiction
  RED classifier could not establish whether the test exposed the intended
  missing invariant or fixture timing. No production edit occurred; the retry
  uses three finite category booleans only.
- 2026-07-31T02:37:35.5362220Z: Closed after finite categories proved the
  signal contradiction and timestamp drift each fulfilled as intended RED,
  then their exact invariants produced safe GREEN rejections without fixture
  or type errors.
- 2026-07-31T03:53:13.0222249Z: Two independent read-only diagnosis scouts
  parsed their captured target runs but expected matcher-category fields that
  the structured payload did not expose consistently. Neither emitted raw
  payloads or changed state. Further diagnosis switches to exact owned
  assertion/helper traces without another runner-schema parser retry.
- 2026-07-31T03:54:04.8639271Z: One scout attempted a second generic
  failure-evidence probe and repeated the schema mismatch without emitting raw
  payload or changing state. Both scouts were interrupted; runner parsing is
  now prohibited for these diagnoses.
- 2026-07-31T03:59:01.8377261Z: Closed after the replacement diagnosis used
  exact assertion/helper traces and returned substantive classifications
  without runner-schema parsing.
