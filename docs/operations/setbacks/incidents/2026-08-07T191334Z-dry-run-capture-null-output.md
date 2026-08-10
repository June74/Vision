# SB-20260807-191334-dry-run-capture-null-output: Dry-run capture wrapper mishandled empty output

- **Status:** contained
- **First observed:** 2026-08-07T19:13:34Z
- **Last observed:** 2026-08-10T01:09:31Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, read-only Wrangler dry-run wrapper
- **Version/commit:** No project change; provider-free compile check was not
  evaluated

## Symptom

The bounded capture wrapper called `.Trim()` on a null stream after Wrangler
returned an empty captured output. The wrapper exited before producing a safe
dry-run result.

The same unsafe read pattern recurred during a local read-only poll of the
currently running candidate controller: an empty stdout file was read as
`$null` and `.Trim()` was called before checking for empty content. The
controller process and provider boundary were unaffected.

## Impact

The dry-run result was discarded. No deployment, Cloudflare resource, secret,
key, schedule, binding, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** PowerShell `Get-Content -Raw` can yield `$null` for an
  empty file, and the wrapper did not normalize it before string operations.
- **Rejected hypothesis:** This was not evidence of a Wrangler or provider
  failure; the capture wrapper failed first.

## Correction and prevention

Initialize each captured stream to an empty string and replace it only when a
file exists and returns non-null text; then apply the controller's bounded
output contract. Do not rely on a cast alone to normalize an empty PowerShell
pipeline.

## Verification

The corrected compile-only retry exited zero, produced bounded output with no
stderr, and created its temporary output directory. Because the exit was zero,
the safe failure category is `none`; informational mentions of bindings in a
successful compile must not be classified as an error.

## Owner

Codex and project owner.

## Recurrence history

- 2026-08-07T19:13:34Z: First observed; `.Trim()` was called on a null stream.
- 2026-08-07T19:14:35Z: The first cast-based normalization still produced a
  null-stream failure, so its result was discarded. No provider action ran.
- 2026-08-07T19:15:40Z: The initialized-string retry passed the compile-only
  check. The first heuristic classified an informational `binding` mention
  despite zero exit; that category was discarded and the safe result was
  corrected to `none`.
- 2026-08-10T01:09:31Z: A read-only controller-status poll reproduced the
  null-stream wrapper failure while the live controller remained running; the
  status is contained pending a null-safe poll and documentation check.
