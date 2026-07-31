# SB-20260731-020604-task3-restore-test-summary-overflow: Task 3 restore diagnostic printed passing test-name rows

- **Status:** closed
- **First observed:** 2026-07-31T02:06:04.595659Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 isolated integration diagnosis
- **Environment:** Isolated restore/controller worktrees; bounded diagnostic output
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus restore repair

## Symptom

ANSI normalization did not collapse captured Vitest formatting, so the diagnostic printed many passing test-name rows instead of only the failing test name.

## Impact

The bounded-output rule was violated, but no URI, secret, provider value, identifier, protected data, file mutation, or external action occurred.

## Reproduction conditions

Parse captured multi-file Vitest output with an ANSI normalization pattern that
does not cover the runner's actual formatting before selecting result rows.

## Safe evidence

Only repository test names were printed. The writer confirmed that no URI,
identifier, secret, provider value, protected data, assertion payload, or
runtime stream value accompanied them.

## Attempts and outcomes

- The broad classifier overselected passing rows.
- Safe evidence still narrowed the real failure to one security test file and
  one assertion.
- Aggregate captured-output parsing was stopped.
- A later ENOENT diagnostic correctly proved canonical cwd and client
  directory existence, but attempted path normalization before stripping ANSI
  controls and failed with a safe local category.

## Cause classification

- **Confirmed cause:** The one-off ANSI cleanup did not normalize the focused
  runner's formatting, so the row selector matched passing results.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No URI, identifier, secret, provider value, protected
  data, file mutation, network request, or external action occurred.

## Correction and prevention

- **Correction:** Run only the already-known failing test and emit a single
  boolean assertion category.
- **Prevention:** Do not parse aggregate Vitest streams for names in this
  lane; use exact test-file selection and pass/fail counts. Strip all control
  sequences before passing any captured token to a path API.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The exact failing security test, six-file integration group, documentation
gate, build, crypto validator, security evidence, and release scan all
completed without another output overflow.

## Recurrence history

- 2026-07-31T02:06:04.595659Z: First observed.
- 2026-07-31T02:18:00.9303916Z: The canonical-cwd diagnostic confirmed the
  assigned worktree and client directory exist, but ANSI characters remained
  in the captured ENOENT token and `GetFullPath` rejected it. No path value was
  printed and no state changed; control stripping is required before the next
  boolean comparison.
- 2026-07-31T02:31:39.1928445Z: Closed after all subsequent restore
  integration, documentation, build, security, and release diagnostics used
  bounded counts/categories with no recurrence.
- 2026-07-31T03:51:39.6305617Z: A controller diagnosis scout returned one
  harmless aggregate count even though its stricter task instruction prohibited
  all emitted values. No source, identifier, literal, message, location,
  stream, mutation, or external state was involved. The scout stopped and may
  resume only with count-free classifications.
- 2026-07-31T03:57:22.7459514Z: Closed after the replacement trace used
  count-free classifications and emitted no runner/source payload.
- 2026-07-31T04:34:16.2102776Z: Reopened as contained after a recursive
  verification-temp metadata listing returned too many local filename rows
  and the tool result was truncated. No file contents, credential material,
  provider data, protected identifiers, mutation, or external action was
  involved. Further inspection is restricted to aggregate counts before exact
  validated cleanup.
- 2026-07-31T04:34:56.6319583Z: Closed after aggregate-only inspection found
  two verification files totaling 2,839 bytes and exact path validation
  preceded permanent removal of the `.tmp` directory.
- 2026-07-31T05:12:34.0944722Z: Reopened as contained after the workflow
  reviewer used a broad requirement-document search that returned 431 metadata
  rows and was truncated. No sensitive value, source mutation, provider
  access, or external state was involved. The reviewer switched to bounded
  ranges and count-only searches.
- 2026-07-31T05:26:43.5989902Z: Closed after the reviewer completed the
  package-only workflow review using bounded reads without another overflow.
- 2026-07-31T14:10:00Z: Reopened as contained after a ledger `apply_patch`
  response exceeded the model-output bound and was truncated. No source,
  credential, provider data, protected identifier, external state, or raw
  runtime stream was exposed; whether the small documentation patch applied
  was initially unknown.
- 2026-07-31T14:11:03.5905501Z: Closed after bounded exact-file reads proved
  the earlier documentation-incident closure had applied and no unsafe output
  or state change occurred.
- 2026-07-31T14:58:22.4964062Z: Reopened as contained after the final resolver
  repair used an overly broad initial source/test inspection and the tool
  response was truncated. Only repository text and filenames were involved;
  no secret, URI, provider data, protected identifier, mutation, or external
  action occurred. The lane stopped before edits and must resume with bounded
  searches and exact ranges.
- 2026-07-31T15:01:15.7489852Z: The restore-bounds lane combined two source,
  test, and reference reads and again exceeded the output budget. Repository
  code/documentation was the only visible material; no secret, provider data,
  protected identifier, mutation, or external action occurred. The lane
  stopped before analysis or edits and must use one exact section per read.
- 2026-07-31T15:25:17.6300421Z: The root combined diff audit disabled Windows
  conversion settings, causing CRLF-normalized lines to be classified as
  trailing whitespace. Git emitted thousands of repository lines and the tool
  response was truncated. No secret, provider data, protected identifier,
  mutation, or external action occurred. That result is invalid; the retry
  must use the ordinary diff semantics with both output streams suppressed and
  emit only the exit category.
- 2026-07-31T15:30:50.5669463Z: Closed after the ordinary output-suppressed
  diff check, combined focused group, and complete repository pipeline all
  exited successfully without another output overflow.
