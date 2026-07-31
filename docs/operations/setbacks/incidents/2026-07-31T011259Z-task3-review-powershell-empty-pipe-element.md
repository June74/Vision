# SB-20260731-011259-task3-review-powershell-empty-pipe-element: Task 3 review metadata command used invalid PowerShell pipeline syntax

- **Status:** contained
- **First observed:** 2026-07-31T01:12:59.175620Z
- **Last observed:** 2026-07-31T04:26:20.8483541Z
- **Phase/task:** Phase B Task 3 decisive review
- **Environment:** Windows PowerShell; read-only subagent review
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5

## Symptom

A read-only metadata command failed at parse time with EmptyPipeElement because a foreach statement block was piped directly in an unsupported form.

## Impact

The reviewer paused before package analysis; no repository or provider state changed and no sensitive output occurred.

## Reproduction conditions

Pipe a PowerShell `foreach (...) { ... }` statement block directly into
`Format-Table` without first grouping or assigning the produced objects.

## Safe evidence

Two independent read-only reviewers reported the same `EmptyPipeElement` parser
failure before package analysis. Both reports confirmed zero repository,
provider, network, or sensitive-output effects.

## Attempts and outcomes

- The first reviewer stopped and reported the parser failure as required.
- A second reviewer independently encountered the same command-shape failure,
  establishing a recurrence rather than a new incident class.
- Both reviewers switched to a valid read-only command form and continued.
- The security reviewer later repeated the parser class in a second ad-hoc
  expression. It stopped that form and returned to the established
  array-then-pipe template.
- A fresh deadline/recovery adjudicator repeated the same parser class in its
  first inventory command before reading any project content.
- The isolated restore writer later used a PowerShell `foreach` statement
  block despite the explicit command-shape prohibition. That read succeeded,
  but it violated the prevention control and was stopped before edits.

## Cause classification

- **Confirmed cause:** The metadata helper used a statement-form `foreach`
  directly on the left side of a pipeline, which is invalid in this PowerShell
  parsing context.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Package corruption or a repository/tooling failure.
- **Known exclusions:** No file, Git, provider, network, or secret-bearing
  operation ran before the parse failure.

## Correction and prevention

- **Correction:** Assign the `foreach` output to a variable (or wrap it as an
  array expression) and pipe that value to the formatter.
- **Prevention:** Review instructions and helper snippets must use
  `$rows = foreach (...) { ... }` followed by `$rows | Format-Table`; do not
  place any statement-form `foreach` directly before a pipe. For the remainder
  of this review, subagent inspection commands must not use PowerShell
  `foreach` statement blocks at all. Use single-purpose `Select-String`,
  `Get-Content`, Git metadata commands, or a previously validated helper with
  bounded output.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete all decisive package reviews without
  another parser-class recurrence, then close this incident.

## Verification and related work

The affected reviewers resumed read-only analysis without changing the
immutable package. Closure is pending one recurrence-free completion pass.

## Recurrence history

- 2026-07-31T01:12:59.175620Z: First observed.
- 2026-07-31T01:13:17.5856280Z: Recurred independently in the parallel
  security review; both reviewers adopted the valid two-statement form and
  continued.
- 2026-07-31T01:21:05.1858938Z: Recurred in a second ad-hoc security-review
  expression after the initial correction. No command body executed and no
  state changed. The lane is now restricted to the known-valid
  array-then-pipe template.
- 2026-07-31T01:29:26.9016436Z: A new deadline/recovery adjudicator used the
  invalid pattern in its first read-only inventory command. Nothing was read
  or changed. All further Task 3 subagent inspection commands are barred from
  using PowerShell `foreach` statement blocks.
- 2026-07-31T01:46:26.2230913Z: The isolated restore writer used a prohibited
  `foreach` statement block in a successful read-only command. No mutation or
  external action occurred. The lane was redirected to bounded
  `ForEach-Object`, line-number, and count-only commands.
- 2026-07-31T04:26:20.8483541Z: A migration-byte comparison used unsupported
  C# generic-call syntax in PowerShell and failed during parsing before any
  file read or state change. The replacement uses ordinary byte encoding and
  count-only output.
