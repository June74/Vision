# `src/jobs/temporary-preview-fault.ts`

Defines the one-minute candidate action `acceptance.preview-fault` and the
closed `vision.preview-fault/v1` evidence schema.

## `createTemporaryPreviewFaultEvidence`

Maps only `r2_upload_failed` to
`failed/backup_storage_write_failed`; all other admitted scenarios map to
`succeeded/none`.

## `runTemporaryPreviewFault`

Parses the environment before invoking `runR2Upload`. It emits exactly one
closed terminal entry and preserves the constant scheduled backup-write failure
for the R2 candidate.

## `putIfAbsent`

Implements the injected pre-mutation failure boundary and never calls R2.
