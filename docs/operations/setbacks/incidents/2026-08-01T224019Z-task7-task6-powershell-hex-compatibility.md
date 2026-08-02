# Task 7 Task 6 PowerShell hex compatibility

- **Occurred:** 2026-08-01T22:40:19.4639844Z
- **Status:** closed
- **Last observed:** 2026-08-02T02:03:55.7041392Z
- **Recurrence resolved:** 2026-08-02T02:03:55.7041392Z
- **Resolved:** 2026-08-01T22:40:48.9206142Z
- **Phase:** Phase B tracked correlation repair Task 6 preflight and Task 7 publication fingerprint preflight
- **Category:** local tooling compatibility

## What happened

The first private metadata-fingerprint attempt failed because this Windows PowerShell runtime does not provide `System.Convert.ToHexString`.

The command stopped before storing a baseline. It printed no filenames, paths within the control root, fingerprint values, or file contents, and it made no filesystem changes.

## Impact

Task 6 remains safely contained, but the default-control non-mutation baseline has not yet been recorded.

## Root cause

The fingerprint helper assumed a newer .NET API than the PowerShell runtime available in this workspace.

## Corrective action

Retry the same metadata-only fingerprint using the compatible `BitConverter.ToString(...).Replace('-', '').ToLowerInvariant()` conversion. Keep the result private and report only a bounded item count.

The compatible retry succeeded. The baseline is held privately for the post-Task 6 equality check; no fingerprint value or control-root entry name was disclosed.

## Prevention

Use Windows PowerShell-compatible byte-to-hex conversion in repository maintenance helpers unless the runtime version has been explicitly verified.

## Recurrence history

- 2026-08-02T02:00:05.8691734Z: The unavailable conversion API was used again
  while privately fingerprinting the fully staged publication candidate. The
  command stopped before producing or storing a fingerprint; it changed no
  repository, remote, deployment, provider, calendar, credential, or key
  state. The retry must use the already-documented compatible conversion.
- 2026-08-02T02:00:41.8883041Z: The compatible conversion completed and the
  candidate fingerprint was stored privately without disclosing its value.
  This verified the documented correction and closed the recurrence.
- 2026-08-02T02:03:12.4027193Z: Independent review found one Minor ledger
  mismatch: the incident retained only its original Task 6 phase while the
  index described the Task 7 publication recurrence. The correction must make
  both phase descriptions identical before the candidate is reviewed again.
- 2026-08-02T02:03:55.7041392Z: The incident and index phase descriptions now
  match exactly, and documentation coverage passed. The correction is verified
  locally and the recurrence is closed pending the fresh whole-candidate
  review required by the publication plan.
