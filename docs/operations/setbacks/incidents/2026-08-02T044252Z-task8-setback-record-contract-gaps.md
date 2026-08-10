# SB-20260802-044252-task8-setback-record-contract-gaps: Changed setback records used incomplete legacy formats

- **Status:** closed
- **First observed:** 2026-08-02T04:42:52.178456Z
- **Last observed:** 2026-08-02T18:21:10.6639720Z
- **Phase/task:** Phase B Task 8 through OAuth reconnect Task 2 operational-record reconciliation
- **Environment:** Local Phase B worktree documentation audit
- **Version/commit:** `e283410`

## Symptom

The initial exact-heading audit reported ten incident files as incomplete. An
independent semantic review confirmed five genuine legacy-format gaps and five
structurally complete records that the mechanical check had misclassified.

## Impact

Operational evidence was incomplete or ambiguously structured; application, provider, database, calendar, credential, and key state were unaffected.

## Reproduction conditions

Run exact-heading and semantic-contract checks over only the currently changed
setback incident files.

## Safe evidence

The initial check returned ten filenames only. Independent review classified
five as genuine gaps and five as equivalent complete structures without
returning private values or raw external output.

## Attempts and outcomes

- The mechanical audit reported ten files.
- Independent semantic review confirmed five genuine gaps and rejected five
  false positives.
- The five genuine records were normalized without changing their incident
  meaning or recurrence history.
- The exact five-file required-section check then passed with zero failures.

## Cause classification

- **Confirmed cause:** Five changed legacy records lacked explicit required
  metadata or evidence sections.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** All ten initial matches were not defective. One used
  an equivalent combined heading, and four complete records did not need an
  empty recurrence section. A later multiline-regex check also misclassified
  valid CRLF headings and is not authoritative.
- **Known exclusions:** No application, provider, database, calendar,
  credential, deployment, or key state changed.

## Correction and prevention

- **Correction:** Add the missing contract fields to only the five semantically
  incomplete records.
- **Prevention:** Pair structural checks with semantic review and newline-safe
  matching before classifying an incident as incomplete.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The five repaired files now contain every required section, with zero failures
in the exact bounded check. Independent review reported no Critical finding and
identified the same five genuine gaps.

## Recurrence history

- 2026-08-02T04:42:52.178456Z: First observed.
- 2026-08-02T04:50:42.4814293Z: Semantic review separated five genuine gaps
  from five mechanical false positives; only the genuine gaps were repaired,
  and the exact five-file verification passed.
- 2026-08-02T18:21:10.6639720Z: Recurred when the reconnect-proof incident
  edit appended a populated `Rejected hypotheses` field without removing its
  empty predecessor. A bounded read found the duplicate immediately, and the
  correction removed only the empty field. No implementation or external
  state changed.
