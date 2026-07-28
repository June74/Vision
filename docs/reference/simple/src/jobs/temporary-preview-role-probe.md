# `src/jobs/temporary-preview-role-probe.ts`

Runs the temporary preview read probe and returns only a fixed success or
failure record.

## `runTemporaryPreviewRoleProbe`

Accepts only the preview environment and temporary database binding. A true
adapter result succeeds, false reports a role mismatch, thrown adapter
failures report a query failure, and invalid settings never call the adapter.

## `failedEvidence`

Creates one immutable four-field failure record without retaining settings,
database values, role values, or error text.
