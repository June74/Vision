# SB-20260810-011812-local-audit-powershell-pipeline-parse: Local Phase B audit probe had a PowerShell pipeline parse error

- **Status:** contained
- **First observed:** 2026-08-10T01:18:12Z
- **Last observed:** 2026-08-10T20:40:29.268Z
- **Phase/task:** Phase B local evidence audit while the monitored preview retry waited at the schedule checkpoint
- **Environment:** Windows PowerShell read-only audit command
- **Version/commit:** `8793f88`

## Symptom

A read-only probe intended to count remaining `TODO`, `FIXME`, and pending markers failed before execution with PowerShell parser error `An empty pipe element is not allowed`.

## Impact

Only that audit probe was unavailable. No Vision source, provider resource, deployment, schedule, binding, secret, key, or user data was changed. The independent documentation check and the monitored controller were unaffected.

## Reproduction conditions

The probe embedded a nested pipeline inside an array/object expression while composing sample locations. PowerShell parsed the expression as an empty pipeline element before any file search ran.

## Safe evidence

- The tool returned a PowerShell `ParserError` with `FullyQualifiedErrorId: EmptyPipeElement`.
- The command performed no provider or filesystem mutation.
- No secret, identifier, URL, or private content was captured.

## Cause classification

- **Confirmed cause:** malformed PowerShell expression in the local audit wrapper.
- **Rejected hypotheses:** This was not a controller, R2, Wrangler, network, deployment, or application failure.

## Correction and prevention

- **Correction:** Replace the nested pipeline expression with a simple bounded loop and explicit intermediate arrays before rerunning the audit.
- **Prevention:** Keep PowerShell collection construction in separate statements and run `-Command` parse validation before using a composed read-only probe.
- **Owner:** Codex.

## Verification and related work

- `pnpm.cmd docs:check` completed successfully in the same audit pass.
- The existing monitored candidate controller remained active and waiting for fresh baseline schedule confirmation.

## Recurrence history

- 2026-08-10T01:18:12Z: First observed; contained after identifying the wrapper syntax boundary.
- 2026-08-10T01:29:42.5268734Z: Two recursive marker probes repeated the same
  parser error by piping directly from a `foreach` statement. No files or
  external state changed; the corrected pattern uses an explicit intermediate
  array before JSON conversion.
- 2026-08-10T19:02:38.397Z: A bounded named-environment-variable presence probe
  repeated the same empty-pipeline parser error before execution. No values,
  files, provider state, or credentials were accessed; the probe was replaced
  with an explicit result array.
- 2026-08-10T20:17:34.701Z: A status-only GitHub CLI credential-file metadata
  probe repeated the empty-pipeline parser error in an inline `if` expression.
  No file content or credential value was read; the probe was replaced with an
  explicit result variable.
- 2026-08-10T20:40:29.268Z: A bounded Wrangler deployment-record field-name
  probe had a missing closing brace before execution. No provider request or
  file state changed; the field projection was rewritten with explicit
  statements.
