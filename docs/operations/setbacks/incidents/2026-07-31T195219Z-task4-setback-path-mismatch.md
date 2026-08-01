# SB-20260731-195219-task4-setback-path-mismatch: Task 4 setback inspection omitted the incidents directory

- **Status:** closed
- **First observed:** 2026-07-31T19:52:19.8441691Z
- **Last observed:** 2026-07-31T19:52:19.8441691Z
- **Phase/task:** Phase B Task 4 setback-ledger maintenance
- **Environment:** Local documentation inspection
- **Version/commit:** c23e301

## Symptom

The initial ledger inspection addressed a known incident filename directly
under `docs/operations/setbacks` even though incident files live in its
`incidents` child directory. The read command failed.

## Impact

No file changed. Logging was delayed by one diagnostic command.

## Cause classification

- **Confirmed cause:** The command used the parent directory instead of the
  path recorded in the index link.
- **Hypotheses:** None remaining.
- **Known exclusions:** No implementation, provider, network, environment,
  secret, staging state, or commit changed.

## Correction and prevention

- **Correction:** Read the incident through the exact relative link in
  `docs/operations/setbacks/INDEX.md`.
- **Prevention:** Resolve incident paths from the index rather than reconstructing
  their directory from memory.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correct location is confirmed.

## Recurrence history

- 2026-07-31T19:52:19.8441691Z: Observed, corrected, and closed before any write.
