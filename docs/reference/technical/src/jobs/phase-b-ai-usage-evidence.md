# `src/jobs/phase-b-ai-usage-evidence.ts`

## `createPhaseBAiUsageEvidence`
Reconstructs one exact evidence record.
## `runPhaseBAiUsageEvidence`
Reads the Chicago accounting aggregate, then sequentially proves the status
and calendar paths before setting `nonAiAvailable`.
## `emitPhaseBAiUsageEvidence`
Emits the closed terminal action.
## `unavailableEvidence`
Returns canonical unavailable evidence.

Owns the fixed `vision.ai-usage/v1` contract and emits only the
`acceptance.ai-usage` action.

## Evidence contract

The frozen record includes admitted monthly cents, fixed 800/900/950 values,
the shared spend tier, same-run Gateway attestation boolean, and a boolean
derived from both non-AI reads. It permits only `none`, `unavailable`,
`inconsistent`, or `limit_exceeded`; raw source errors and ledger identities
cannot be serialized.
