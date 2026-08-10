# SB-20260810-210431-wrangler-failure-classifier-false-not-found: Deploy failure classifier reported a provider resource lookup that never happened

- **Status:** contained
- **First observed:** 2026-08-10T21:04:31Z
- **Last observed:** 2026-08-10T21:04:31Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Windows PowerShell, local controller boundary, Wrangler 4.113.0
- **Version/commit:** Reviewed `codex/phase-b-foundation` checkout; ignored operational artifacts only

## Symptom

Every failed candidate deploy was reported as
`candidate_deploy_resource_missing` with signature `not_found`, and the
matching rollback as `rollback_outcome_uncertain`/`resource_missing`. That
category was escalated into a drafted Cloudflare support case asserting that
the Worker upload was rejected during a provider resource lookup before any
version was created.

No provider resource lookup failure occurred. The category was produced
entirely by the local classifier.

## Impact

A support case was prepared against Cloudflare on a false premise, and Phase B
live-deployment acceptance was blocked while the real cause went unexamined.
Four attempts were attributed to the provider that the evidence does not
support.

## Cause classification

**Confirmed cause.** `Get-WranglerFailureFingerprint` in
`.superpowers/sdd/corrected-redeploy-controller.ps1` matched the signature
pattern `(?i)\bnot\s+found\b` against the head of Wrangler's debug log. Wrangler
opens every log, including logs of successful runs, with:

```
.env file not found at "<repo>\.env". Continuing... For more details, refer to ...
.env file not found at "<repo>\.env.local". Continuing... For more details, refer to ...
```

Those lines sit at roughly bytes 150-650. The scan was bounded to the first
4096 characters (`MaxLogChars`) and returned the first signature in declaration
order, so:

- the benign preamble always matched `not_found`;
- `not_found` outranks `does_not_exist` and `validation`, so it also masked
  genuine lower-precedence causes;
- the real provider error, written at the tail of the log, was never read.

Any nonzero Wrangler exit therefore classified as `resource_missing`
regardless of cause. Confirmed by replaying the retained
`wrangler-2026-08-10_01-41` log through both controller revisions: baseline
returned `resource_missing`, the fixed revision returns `unknown_failure`.

**Rejected hypotheses**, each disproved by read-only checks or bounded probes:

- *Missing R2 bucket or Queue.* Both exist. The Queue reports one producer and
  one consumer, both attributed to the preview Worker.
- *Account or token scope mismatch.* The authenticated account owns the Worker,
  and the token carries `workers_scripts (write)` and `queues (write)`.
- *Environment inheritance.* The candidate artifact config is correctly
  flattened: `VISION_ENV: "preview"` with `BACKUP_BUCKET` bound to the preview
  backup bucket.
- *`--strict` rejecting a conflicting remote change.* `--strict` prevents
  uploads when remote changes conflict, and the Worker does carry out-of-band
  secret additions from 2026-08-03. A bounded probe through the real wrapper
  with `--strict` returned exit 0, refuting this.
- *Controller wrapper defect.* Driving `Invoke-NativeBounded` directly with the
  production launch mechanics returned exit 0 in 7.3s with no failure category.

**Known exclusions.** No credential, key, schedule, database, or calendar
mutation was made during this investigation.

## Correction

Three changes to `Get-WranglerFailureFingerprint` and its helpers. The file is
an ignored operational artifact, so the diff is reproduced here.

1. New `Remove-BenignWranglerNoise`, applied to stream chunks and to the log
   before signature matching:

```powershell
$benignPatterns = @(
  "(?i)\.env\S*\s+file\s+not\s+found\s+at\b",
  "(?i)Writing logs to\b",
  "(?i)Metrics dispatcher:",
  "(?i)omitted; set WRANGLER_LOG_SANITIZE=false"
)
```

2. The temporary-log scan now reads the bounded **tail** rather than the
   bounded head, because the provider error is the last thing Wrangler writes:

```powershell
$tailStart = [Math]::Max([long]0, $stream.Length - [long]$MaxLogChars)
if ($tailStart -gt 0) { [void]$stream.Seek($tailStart, [IO.SeekOrigin]::Begin) }
```

3. The `network` signature no longer matches the bare substring `network`:

```powershell
Pattern = "(?i)connection reset|network error|network is unreachable|\bdns\b|econn|socket hang up|fetch failed"
```

The privacy contract is unchanged: the scan stays bounded at 4096 bytes, no raw
provider text is retained, and the temporary log is still destroyed by the
existing cleanup.

## Verification

- New contract cases in
  `test-corrected-redeploy-wrangler-failure-classifier.ps1`: benign preamble
  alone classifies `unknown_failure`; preamble plus a real validation error
  classifies `validation_failed`; preamble plus a genuine missing-queue error
  still classifies `resource_missing`; an error at the log tail beyond 20 KB of
  noise is found; an error above the tail window is not.
- RED confirmed before the fix, GREEN after.
- Mutation checked in an isolated copy: neutralising the noise filter fails
  `classifier_benign_preamble_invalid`; restoring the head-seek fails
  `classifier_log_bound_invalid`.
- Full local suite 15/17. The two failures
  (`test-corrected-redeploy-native-adapters`,
  `test-corrected-redeploy-native-suite`, both `wrangler_adapter_probe_invalid`)
  reproduce identically against a pristine baseline copy and predate this
  change.

## Prevention

No allowlisted failure category may be derived from a pattern that also matches
output produced by a successful run. Any new signature needs a negative case
proving it does not fire on a clean log before it is added.

## Follow-up: unattributed promotion of a probe version

While diagnosing, three no-traffic versions were uploaded from this session,
tagged `diag-classifier-verify`, `diag-wrapper-probe`, and `diag-strict-probe`.
At 2026-08-10T20:37:36Z a deployment recorded as "Promote version to 100%"
moved the first of these to full preview traffic, displacing the reviewed
2026-08-03 deployment.

The actor is not established. No command from this session was in flight at
that time: the session's provider writes were at 20:29:54, 20:45:26, and
approximately 20:47, and a read-only check at approximately 20:30 confirmed the
2026-08-03 deployment was still active. A concurrent session recorded its own
setback at 20:38:02, and workflow run 31428489171 was in flight from 20:19:53
for 10m36s. None of this identifies the actor.

What is attributable to this session is the artifact: the promoted version was
uploaded here. Preview health remained HTTP 200 with the `ok` contract
throughout. The owner is restoring the 2026-08-03 deployment.

## Immediate handling

Withdraw the drafted Cloudflare support case in
`docs/operations/cloudflare-support-review.md`; its premise is disproved. Do
not open a provider case for this symptom. The remaining untested difference is
`wrangler deploy` itself versus `versions upload` — the trigger and deployment
creation steps — which cannot be exercised without shifting live traffic and
needs separate approval.

## Recurrence history

- 2026-08-10T21:04:31Z: First observed while tracing the reported provider
  rejection; classifier corrected, guards added, and the provider hypothesis
  refuted by bounded probes.
