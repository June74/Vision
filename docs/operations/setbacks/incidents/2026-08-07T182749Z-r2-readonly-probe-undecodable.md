# SB-20260807-182749-r2-readonly-probe-undecodable: Read-only R2 bucket probe was not decodable

- **Status:** closed
- **First observed:** 2026-08-07T18:27:49.652933Z
- **Last observed:** 2026-08-07T18:31:00Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree, read-only Wrangler probe
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

A read-only R2 bucket-list probe was invoked with an unsupported JSON output
shape. It exited nonzero with non-decodable output, so that first probe could
not establish configured-resource existence.

## Impact

No R2, Worker, deployment, rollback, schedule, binding, secret, key, database,
calendar, or private-data state changed; both provider responses were
discarded and no identifiers or payloads were recorded.

## Reproduction conditions

Run `wrangler r2 bucket list --json` against this Wrangler version.

## Safe evidence

The safe classifier identified `command_shape_invalid`. A corrected
read-only text listing exited zero and matched the configured preview bucket
without emitting its name here. Do not paste private or secret values.

## Attempts and outcomes

1. The JSON-shaped probe failed closed with `command_shape_invalid`.
2. The corrected text listing exited zero, returned output, and matched the
   configured bucket in memory; its text was discarded.

## Cause classification

- **Confirmed cause:** This Wrangler version does not support the attempted
  JSON flag for the R2 bucket-list command.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** Missing R2 bucket was not supported by the corrected
  read-only listing match.
- **Known exclusions:** No provider mutation occurred.

## Correction and prevention

- **Correction:** Used the supported text-listing shape, classified only safe
  in-memory booleans, and discarded provider output.
- **Prevention:** Do not assume every Wrangler read command supports `--json`;
  probe help/shape first and keep all provider output bounded and discarded.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

The corrected text listing exited zero and matched the configured bucket; the
incident is closed with no external state change.

## Recurrence history

- 2026-08-07T18:27:49.652933Z: First observed.
