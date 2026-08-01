# SB-20260731-145947-controller-repair-search-truncation: Controller repair search expanded into truncated output

- **Status:** contained
- **First observed:** 2026-07-31T14:59:47.6410820Z
- **Last observed:** 2026-08-01T02:32:27.0021974Z
- **Phase/task:** Phase B Tasks 3 through 7, Gate 0, and exact-tip review
- **Environment:** Delegated read-only plan and specification inspection
- **Version/commit:** c23e301 plus unstaged setback records

## Symptom

A targeted plan/specification search expanded through overlapping contexts and
returned truncated repository-only output.

## Impact

The controller repair stopped before edits. No finding was implemented or
verified in that lane.

## Reproduction conditions

Search multiple overlapping plan/specification contexts in one command rather
than using exact headings and bounded ranges.

## Safe evidence

Only aggregate displayed/total line counts and the truncation category were
reported. No provider data, secret, URI, protected identifier, argument,
environment value, live output, repository mutation, or external action was
involved.

## Attempts and outcomes

- The broad search was stopped immediately.
- No source, test, reference, Git, provider, or external state changed.
- During Task 4 read-only review, one multi-file search again expanded beyond
  its useful boundary and was truncated. The review stopped before relying on
  the incomplete output.
- A second Task 4 search used a wildcard that included directories and large
  review packages; it timed out and returned incomplete output. The command
  made no repository or external changes.
- A later Task 4 diagnostics/environment review batched one large source read
  with a multi-file test search and exceeded the output boundary. The review
  discarded the incomplete output and made no source or external change.

## Cause classification

- **Confirmed cause:** Overlapping search contexts expanded beyond the output
  boundary.
- **Hypotheses:** None required before bounded inspection.
- **Rejected hypotheses:** No controller implementation failure was diagnosed.
- **Known exclusions:** The lifecycle finding set remains unchanged.

## Correction and prevention

- **Correction:** Resume from the supplied finding summary using exact
  function-local ranges and no plan/spec rendering.
- **Prevention:** Do not combine context-expanding searches across large
  authoring documents in repair lanes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

The controller repair completed 53 focused tests, TypeScript, documentation,
owned diff, combined focused, and full repository verification using bounded
function-local inspection without another broad search.

Task 4 review then completed using explicit files and bounded ranges without
another truncation.

## Recurrence history

- 2026-07-31T14:59:47.6410820Z: First observed and contained before edits.
- 2026-07-31T15:30:50.5669463Z: Closed after all controller and integration
  gates passed without recurrence.
- 2026-07-31T19:57:12.2081646Z: Recurred during Task 4 read-only analysis from
  a multi-file search; contained before relying on truncated output or making
  implementation changes.
- 2026-07-31T19:59:10.3291343Z: Recurred because a wildcard admitted
  directories and large review packages; contained by restricting all
  remaining reads to explicit files and bounded ranges.
- 2026-07-31T20:02:05.8106273Z: Closed after the remaining authoritative
  plan, design, source, workflow, and test reads completed within bounds.
- 2026-07-31T20:20:26.9308117Z: Recurred when a Task 4 scope-gap review read
  two large explicit files alongside their references in one parallel result.
  The repository-only output was truncated. Contained by switching to exact
  function and test-name searches followed by bounded local ranges.
- 2026-07-31T20:23:29.5022036Z: Recurred when a multi-file documentation
  heading inventory exceeded the output bound. The first ledger patch then
  detected a concurrent incident update and made no change. Remaining work
  uses exact page-local additions against the current record.
- 2026-07-31T20:25:06.8283361Z: Closed after bounded reads traced the exact
  candidate-config-to-intent-to-provider-validation path and its workflow
  version gate without another truncation.
- 2026-07-31T20:32:40.0416522Z: Recurred during the independent Task 4
  diagnostics/environment review. Contained by discarding the incomplete
  repository-only output and returning to exact file-local function ranges and
  test names.
- 2026-07-31T20:38:28.6760977Z: Recurred when the workflow/window repair
  searched every Task 4 package for several generic hostile-input terms. The
  incomplete repository-only output was discarded; remaining contract reads
  are restricted to the exact review file and bounded ranges.
- 2026-07-31T20:50:37.5421139Z: Closed after all remaining source, test,
  reference, and diff inspections completed with bounded explicit paths.
- 2026-07-31T21:38:17.9726165Z: Recurred during the final Task 4 package
  review when a workflow search and controller trace were combined. The
  incomplete repository-only output was discarded; remaining tracing uses
  one file and one bounded range per command.
- 2026-07-31T21:40:38.9879443Z: Recurred when a broad-context diff of the
  candidate-config preparation script exceeded the review output bound. The
  incomplete repository-only output was discarded; the same file is now read
  only through exact, bounded ranges.
- 2026-07-31T21:41:14.0000000Z: Recurred when a final Task 4 reviewer searched
  broadly across `.superpowers/sdd` and the read-only command timed out. Only
  historical metadata noise was observed; the reviewer continued with bounded
  exact-file reads.
- 2026-07-31T21:42:10.5048070Z: Recurred when the root review combined a
  28-line incident tail with an index lookup and the output exceeded the model
  context. The incomplete repository-only output was discarded; subsequent
  incident reads are limited to ten lines and one exact index match.
- 2026-07-31T21:59:18.2982530Z: Recurred when the Task 5 scheduled-evidence
  lane combined required instruction files in one read and exceeded its output
  limit. It stopped before tests or edits and resumes with one bounded file per
  read.
- 2026-07-31T22:00:55.3182028Z: Recurred when the Task 5 browser-helper lane
  combined three large source/test files and truncated roughly 1,183 lines.
  The incomplete repository-only output was discarded; the lane resumes with
  one bounded exact range per command.
- 2026-07-31T22:45:24.9468046Z: Recurred when the Task 6 R2 lane combined the
  complete release scanner with references and truncated roughly 1,182 lines.
  It stopped before tests or edits and resumes with symbol- and line-bounded
  reads only.
- 2026-07-31T22:46:44.4194128Z: Recurred when the Task 6 cleanup lane combined
  the full cleanup security test with two audit reports and exceeded the output
  bound. The incomplete repository-only output was discarded; the lane resumes
  with one symbol- or range-bounded read per command.
- 2026-07-31T23:02:03.6993294Z: Recurred when the Task 6 R2 reviewer bundled
  four exact package files and still exceeded its output limit. The incomplete
  repository-only output was discarded; re-review uses one file and one range
  at a time after repair.
- 2026-07-31T23:11:44.2606709Z: Recurred when a controller wait result exceeded
  the remaining model-context boundary and was truncated. The incomplete
  coordination output was discarded; the controller resumed from bounded
  individual agent messages and compact status checks.
- 2026-08-01T00:43:15.6288058Z: Recurred while Gate 0's sequential full-gate
  runner emitted the unit-test stream. The tool response exceeded the model
  context even though the yielded process cell remained recoverable. The
  incomplete display is not accepted as evidence; the controller resumes cell
  `761` with a bounded output budget and records only its final per-command
  exit results.
- 2026-08-01T01:27:25.3898759Z: Recurred when five complete skill files were
  combined into one loader response and the subagent-development instructions
  were truncated. The incomplete copy is not relied on; the controller rereads
  that skill in bounded consecutive ranges through EOF.
- 2026-08-01T01:47:18.3849506Z: Recurred when the final exact-tip review wait
  result exceeded the remaining model-context boundary. The incomplete mailbox
  output is not accepted as a verdict; the controller must obtain a concise
  reviewer status or final result before relying on the review.
- 2026-08-01T02:32:27.0021974Z: Recurred when a fresh exact-tip reviewer
  combined the full spec, plan, and evidence in one read before opening the
  authoritative package. The incomplete read was not used for a verdict and
  the review was interrupted. Its replacement must use bounded consecutive
  ranges for every large file from the start.
