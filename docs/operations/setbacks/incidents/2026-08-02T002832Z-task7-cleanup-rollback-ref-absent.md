# Task 7 cleanup context omitted the restore artifact run reference

- **Occurred:** 2026-08-02T00:28:32Z
- **Status:** closed
- **Closed:** 2026-08-02T00:34:47.4428106Z
- **Phase:** Phase B / tracked correlation repair / Task 7 proof-chain reachability GREEN
- **Category:** live input reachability gap

## What happened

Post-GREEN tracing found that `verify_cleanup` did not carry `rollbackRunRef` in its exact acceptance context. Although the workflow now invoked the combined proof-chain validator and referenced a rollback-run environment binding, the selection output for that binding would be empty, so the restore proof artifact could not be downloaded in a real run.

The issue was found locally before review completion or live workflow execution. The independent reviewer was stopped to avoid reviewing a moving target.

## Impact

The current local workflow repair is not live-runnable. Task 7 remains unaccepted. No provider, deployment, database, calendar, R2, authentication, secret, or key state changed.

## Corrective action

- Keep the exact `verify_cleanup` context unchanged.
- Preserve the byte-copied restore proof in the already-authenticated closure artifact alongside the closure proof.
- Require cleanup to download that single closure artifact and validate both fixed proof paths.
- Keep graph tests proving the combined validator receives both files.

## Prevention

A workflow graph repair is incomplete until every new environment binding is traced back through the selection serializer to a mandatory exact input field and a negative missing-field test.

## Resolution evidence

The unnecessary rollback-run binding was removed. The closure artifact now contains the copied restore proof and closure proof, the focused graph test passed, the complete Task 7 suite passed 196/196, and type, documentation, and security gates passed.
