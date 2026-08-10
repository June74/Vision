# SB-20260731-195219-task4-setback-path-mismatch: Task 4 setback inspection omitted the incidents directory

- **Status:** closed
- **First observed:** 2026-07-31T19:52:19.8441691Z
- **Last observed:** 2026-08-02T18:34:50.2999657Z
- **Phase/task:** Phase B Tasks 4 and 8 plus reconnect-recovery Task 2 setback-ledger maintenance
- **Environment:** Local documentation inspection
- **Version/commit:** c23e301

## Symptom

The initial ledger inspection addressed a known incident filename directly
under `docs/operations/setbacks` even though incident files live in its
`incidents` child directory. The read command failed.

## Impact

No file changed. Logging was delayed by one diagnostic command.

## Reproduction conditions

Reconstruct a known incident path from memory beneath the setback root instead
of resolving the exact relative link recorded in the index.

## Safe evidence

The local read returned only a missing-path error before any repository or
external action began.

## Attempts and outcomes

- The reconstructed parent-directory path failed to resolve.
- The exact index-linked path resolved successfully.

## Cause classification

- **Confirmed cause:** The command used the parent directory instead of the
  path recorded in the index link.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The incident file itself was not missing.
- **Known exclusions:** No implementation, provider, network, environment,
  secret, staging state, or commit changed.

## Correction and prevention

- **Correction:** Read the incident through the exact relative link in
  `docs/operations/setbacks/INDEX.md`.
- **Prevention:** Resolve incident paths from the index rather than reconstructing
  their directory from memory.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correct location is confirmed.

## Verification and related work

The exact index-linked incident path was read successfully, and the later
skill-helper recurrence was resolved from its selected skill directory.

## Recurrence history

- 2026-07-31T19:52:19.8441691Z: Observed, corrected, and closed before any write.
- 2026-08-02T04:32:22.0648402Z: Recurred when the Task 8 consistency repair
  resolved the setback skill's `scripts/new_setback.py` path against the
  repository root. The read failed before execution and changed no state. The
  helper was then resolved from the selected skill directory.
- 2026-08-02T18:02:50.0543081Z: Recurred when reconnect-recovery Task 2 again
  resolved the selected setback skill's helper against the repository root.
  Python returned a missing-file error before executing any helper logic. The
  retry resolved the script from the skill directory and its help contract
  exited zero; no implementation, provider, credential, or external state
  changed.
- 2026-08-02T18:34:50.2999657Z: Recurred during reconnect-recovery Task 2
  staging when the implementer reconstructed the known Git-index incident
  basename instead of using the exact link from the setback index. The
  read-only lookup failed before any write; the index-resolved path then read
  successfully. No implementation, staging, provider, network, database, or
  secret state changed.
