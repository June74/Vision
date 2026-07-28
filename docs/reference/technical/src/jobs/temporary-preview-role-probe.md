# `src/jobs/temporary-preview-role-probe.ts`

Implements a dependency-injected preview-only job with no provider, storage,
table, restore, clear, encryption-key, target-identity, or HTTP dependency.

## `runTemporaryPreviewRoleProbe`

Strictly parses the exact two-field `TemporaryRoleProbeEnvSchema`, passes only
the validated temporary connection string to the injected read adapter, and
maps every outcome to `vision.preview-role-probe/v1`. Success requires a true
adapter result. False becomes `role_probe_role_mismatch`; an adapter exception
becomes `role_probe_query_failed`; and any validation rejection becomes
`role_probe_configuration_invalid` without calling the adapter.

## `failedEvidence`

Returns a frozen object containing only evidence type, failed outcome, one
allowlisted category, and `roleMatches: false`.
