# Safe TSX Native Adapter Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one fail-closed TSX launcher adapter to the Phase B redeployment controller and prove that read-only rollback validation succeeds without changing provider state.

**Architecture:** Keep executable policy centralized in `Resolve-NativeProcessAdapter`. Convert only `tsx.cmd` into a direct `node.exe node_modules\tsx\dist\cli.mjs ...` invocation, reuse the existing bounded process runner, and retain rejection of all other unapproved batch launchers.

**Tech Stack:** Windows PowerShell 5.1, Node.js, TSX, Wrangler, Cloudflare Workers, project-local PowerShell contract tests.

## Global Constraints

- Permit only the known `tsx.cmd` leaf name; every unknown `.cmd` or `.bat` launcher must remain rejected.
- Launch TSX through Node directly; never introduce `cmd.exe`.
- Preserve arguments exactly, including empty, quoted, Unicode, and multiline values.
- Preserve existing timeout, output-limit, process-tree cleanup, sanitized-result, schedule-evidence, deployment, rollback, and secret-handling contracts.
- Do not set `XDG_CONFIG_HOME` for live Wrangler validation.
- Do not deploy or mutate Cloudflare during this plan.
- Do not rotate, read, request, or print keys, tokens, credentials, provider payloads, deployment identifiers, account identifiers, or secret values.
- Keep backup key version 1 unchanged.
- Run no more than one subagent at a time on this machine.
- `.superpowers/` is intentionally ignored; do not force-add its controller, tests, logs, challenges, or evidence files to Git.

**Approved review exception:** On 2026-08-03, the owner approved preserving the `.superpowers/` ignore boundary and using a before/after snapshot diff for Task 1 review instead of force-adding or committing the operational controller files.

---

### Task 1: Add and locally prove the explicit TSX adapter

**Files:**
- Modify: `.superpowers/sdd/test-corrected-redeploy-native-adapters.ps1`
- Modify: `.superpowers/sdd/corrected-redeploy-controller.ps1:400-447`
- Verify: `.superpowers/sdd/test-corrected-redeploy-native-suite.ps1`

**Interfaces:**
- Consumes: `Resolve-NativeProcessAdapter(WorkingDirectory, Command, CommandArguments)` and `Invoke-NativeCaptured(WorkingDirectory, Command, CommandArguments, TimeoutSeconds, MaxOutputBytes)`.
- Produces: an explicit `tsx.cmd` branch that returns Node as `Command`, prepends the artifact-local `node_modules\tsx\dist\cli.mjs` to `Arguments`, leaves `IsWrangler` false, and preserves the safe `native_process_adapter_resolution_failed` category.

- [ ] **Step 1: Add the failing TSX runtime and failure-category cases**

Insert this block after the fake Wrangler assertions and before the real Wrangler version probe in `.superpowers/sdd/test-corrected-redeploy-native-adapters.ps1`:

```powershell
  $fakeTsxDirectory = Join-Path $testRoot "node_modules\tsx\dist"
  [void](New-Item -ItemType Directory -Path $fakeTsxDirectory -Force)
  $fakeTsxEntry = Join-Path $fakeTsxDirectory "cli.mjs"
  [IO.File]::WriteAllText(
    $fakeTsxEntry,
    'process.stdout.write(JSON.stringify(process.argv.slice(2)));'
  )
  $fakeTsxCommand = Join-Path $testRoot "tsx.cmd"
  $tsxArguments = @(
    "",
    "plain",
    'quote"value',
    "line`nbreak",
    "snow-雪"
  )
  $tsxResult = Invoke-NativeCaptured `
    -WorkingDirectory $testRoot `
    -Command $fakeTsxCommand `
    -CommandArguments $tsxArguments `
    -TimeoutSeconds 5 `
    -MaxOutputBytes 4096
  if ($tsxResult.ExitCode -ne 0) {
    throw "tsx_adapter_probe_exit_invalid"
  }
  $tsxValues = @(($tsxResult.StandardOutput | ConvertFrom-Json))
  if ($tsxValues.Count -ne $tsxArguments.Count) {
    throw "tsx_adapter_probe_argument_count_invalid"
  }
  for ($index = 0; $index -lt $tsxArguments.Count; $index++) {
    if ([string]$tsxValues[$index] -cne [string]$tsxArguments[$index]) {
      throw ("tsx_adapter_probe_argument_invalid:" + $index)
    }
  }
```

Add this object to `$failureCases`:

```powershell
    [pscustomobject]@{
      WorkingDirectory = $missingRoot
      Command = (Join-Path $missingRoot "tsx.cmd")
    },
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .superpowers\sdd\test-corrected-redeploy-native-adapters.ps1
```

Expected before implementation: nonzero exit containing `native_process_adapter_resolution_failed`, because `tsx.cmd` still reaches the unsupported batch-launcher branch.

- [ ] **Step 3: Implement the minimal centralized TSX adapter**

Insert this branch immediately after the existing `pnpm.cmd` branch and before the generic `.cmd`/`.bat` rejection in `.superpowers/sdd/corrected-redeploy-controller.ps1`:

```powershell
    } elseif ($commandLeaf -ieq "tsx.cmd") {
      $processCommand = (Get-Command node.exe -ErrorAction Stop).Source
      $entryPoint = (Resolve-Path -LiteralPath (
        Join-Path $WorkingDirectory "node_modules\tsx\dist\cli.mjs"
      ) -ErrorAction Stop).Path
      $processArguments = @($entryPoint) + $processArguments
```

Do not change the generic rejection branch or the Wrangler-only bootstrap block.

- [ ] **Step 4: Run the focused test and verify success**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .superpowers\sdd\test-corrected-redeploy-native-adapters.ps1
```

Expected:

```text
native_adapter_contract_ok
```

- [ ] **Step 5: Run the complete native-controller suite**

Run outside the restricted sandbox because the suite creates and forcibly terminates only its own disposable child processes and temporary folders:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .superpowers\sdd\test-corrected-redeploy-native-suite.ps1
```

Expected final line:

```text
corrected_redeploy_native_suite_ok
```

The preceding output must include all 12 focused contract success markers for timeout, capture, output limit, cleanup deadline, adapters, process API, tree arguments, bounded Wrangler JSON, timeout recovery, rollback uncertainty, correlation, and source scope.

- [ ] **Step 6: Perform one independent read-only review**

Give one sequential reviewer only these questions:

1. Does `tsx.cmd` resolve solely to Node plus the artifact-local TSX entrypoint?
2. Can any other unapproved `.cmd` or `.bat` now execute?
3. Do the tests prove difficult argument preservation and missing-entrypoint failure?
4. Did any Wrangler bootstrap, timeout, cleanup, output, deployment, rollback, or secret contract change?

Expected: no Critical or Important findings. If a finding is valid, add a failing regression case first, then make the smallest correction and rerun Steps 4-6.

- [ ] **Step 7: Confirm the repair remains an ignored operational artifact**

Run:

```powershell
git check-ignore -q .superpowers/sdd/corrected-redeploy-controller.ps1
git check-ignore -q .superpowers/sdd/test-corrected-redeploy-native-adapters.ps1
```

Expected: both commands exit zero. Do not force-add either file; their evidence is recorded in the tracked incident ledger after live verification.

---

### Task 2: Re-run read-only rollback validation and close the evidence trail

**Files:**
- Runtime only: `.superpowers/sdd/corrected-redeploy-controller.ps1`
- Runtime only: `.superpowers/sdd/live-schedule-baseline-challenge.json`
- Runtime only: `.superpowers/sdd/live-schedule-baseline.json`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T190323Z-readonly-validation-wrangler-json-query-failed.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T191214Z-xdg-override-hid-wrangler-auth.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T191700Z-readonly-native-adapter-resolution.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T191708Z-schedule-config-discovery-command-errors.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T191836Z-git-nul-excludes-override-invalid.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T192219Z-design-spec-git-index-sandbox-denied.md`
- Modify: `docs/operations/setbacks/incidents/2026-08-03T192241Z-tsx-design-spec-trailing-whitespace.md`

**Interfaces:**
- Consumes: `corrected-redeploy-controller.ps1 -Mode validate_current_rollback`, normal saved Wrangler authentication, and fresh user-confirmed schedule evidence.
- Produces: sanitized JSON with `current_rollback_valid: true`, updated incident records, and no deployment or provider mutation.

- [ ] **Step 1: Launch one uniquely logged read-only controller run**

Run outside the restricted sandbox with the normal saved Wrangler authentication. Do not set or override `XDG_CONFIG_HOME`:

```powershell
$ErrorActionPreference = "Stop"
$runId = [Guid]::NewGuid().ToString("N")
$controller = (Resolve-Path -LiteralPath ".superpowers\sdd\corrected-redeploy-controller.ps1").Path
$logRoot = (Resolve-Path -LiteralPath ".superpowers\sdd").Path
$stdoutPath = Join-Path $logRoot ("readonly-controller-" + $runId + ".stdout.log")
$stderrPath = Join-Path $logRoot ("readonly-controller-" + $runId + ".stderr.log")
$argumentLine = '-NoProfile -ExecutionPolicy Bypass -File "' + $controller + '" -Mode validate_current_rollback'
Start-Process `
  -FilePath (Get-Command powershell.exe -ErrorAction Stop).Source `
  -ArgumentList $argumentLine `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru | Out-Null
```

Retain `$runId`, `$stdoutPath`, and `$stderrPath` in the execution record. Do not print their contents.

- [ ] **Step 2: Detect only a fresh baseline challenge**

Poll only the exact log lengths/timestamps and the baseline challenge timestamp. A valid new challenge must be newer than this run's stdout-log creation time:

```powershell
$challengePath = Join-Path $logRoot "live-schedule-baseline-challenge.json"
$stdoutInfo = Get-Item -LiteralPath $stdoutPath
$challengeInfo = Get-Item -LiteralPath $challengePath
if ($challengeInfo.LastWriteTimeUtc -le $stdoutInfo.CreationTimeUtc) {
  throw "baseline_challenge_not_fresh"
}
```

Do not print or copy the challenge JSON or nonce.

- [ ] **Step 3: Obtain and bind fresh user-visible schedule confirmation**

Ask the user to confirm that Cloudflare visibly shows exactly:

```text
*/15 * * * *
5 6 * * *
```

After confirmation, create the nonce-bound proof without emitting its contents:

```powershell
$evidencePath = Join-Path $logRoot "live-schedule-baseline.json"
$challenge = Get-Content -Raw -LiteralPath $challengePath | ConvertFrom-Json
if ([string]$challenge.schema -ne "vision.preview-live-schedule-challenge/v1") {
  throw "baseline_challenge_schema_invalid"
}
if ([string]$challenge.label -ne "baseline") {
  throw "baseline_challenge_label_invalid"
}
if ([string]$challenge.nonce -notmatch "^[a-f0-9]{32}$") {
  throw "baseline_challenge_nonce_invalid"
}
if ([string]$challenge.activeVersionSha256 -notmatch "^[a-f0-9]{64}$") {
  throw "baseline_challenge_version_hash_invalid"
}
$issuedAt = [DateTimeOffset]::Parse(
  [string]$challenge.issuedAt,
  [Globalization.CultureInfo]::InvariantCulture,
  [Globalization.DateTimeStyles]::RoundtripKind
)
if (([DateTimeOffset]::UtcNow - $issuedAt).TotalSeconds -gt 600) {
  throw "baseline_challenge_expired"
}
$evidence = [ordered]@{
  schema = "vision.preview-live-schedules/v1"
  source = "cloudflare_dashboard_visible"
  label = "baseline"
  challengeNonce = [string]$challenge.nonce
  challengeIssuedAt = $issuedAt.ToUniversalTime().ToString("o")
  activeVersionSha256 = [string]$challenge.activeVersionSha256
  observedAt = [DateTimeOffset]::UtcNow.ToString("o")
  crons = @("*/15 * * * *", "5 6 * * *")
}
[IO.File]::WriteAllText(
  $evidencePath,
  ($evidence | ConvertTo-Json -Compress),
  [Text.UTF8Encoding]::new($false)
)
```

- [ ] **Step 4: Decode only the sanitized controller outcome**

Wait until stdout is nonempty or stderr is nonempty. Require empty stderr, require stdout between 1 and 4096 bytes, JSON-decode it, and emit only these allowlisted fields:

```powershell
$stdoutInfo = Get-Item -LiteralPath $stdoutPath
$stderrInfo = Get-Item -LiteralPath $stderrPath
if ($stderrInfo.Length -ne 0) { throw "readonly_stderr_not_empty" }
if ($stdoutInfo.Length -le 0 -or $stdoutInfo.Length -gt 4096) {
  throw "readonly_stdout_size_invalid"
}
$result = Get-Content -Raw -LiteralPath $stdoutPath | ConvertFrom-Json
[ordered]@{
  current_rollback_valid = [bool]$result.current_rollback_valid
  candidate_preconditions_passed = [bool]$result.candidate_preconditions_passed
  candidate_accepted = [bool]$result.candidate_accepted
  failure_category = if ($null -eq $result.failure_category) {
    $null
  } else {
    [string]$result.failure_category
  }
  rolled_back = [bool]$result.rolled_back
  rollback_verified = [bool]$result.rollback_verified
} | ConvertTo-Json -Compress
```

Expected:

```json
{"current_rollback_valid":true,"candidate_preconditions_passed":false,"candidate_accepted":false,"failure_category":null,"rolled_back":false,"rollback_verified":false}
```

- [ ] **Step 5: Resolve the tracked incident records with exact conclusions**

Use `apply_patch` and make these evidence-backed updates:

- `190323`: mark resolved; record that the task-local XDG override hid normal Wrangler authentication, while the no-override run reached and accepted a fresh schedule challenge. Preserve the fact that no provider mutation occurred.
- `191214`: replace template fields, mark resolved, record the plain-`whoami` false-positive exit behavior, and prohibit XDG overrides for normal saved Wrangler authentication.
- `191700`: mark resolved only after Task 1's focused test, full 12-check suite, independent review, and Step 4's successful live read-only result. Record the missing explicit TSX adapter as the confirmed cause.
- `191708`: mark resolved; record the broken recursive dependency path and invalid first pipeline, followed by the successful bounded tracked-file lookup. Prevent recurrence by avoiding broad dependency-tree recursion and grouping PowerShell loop output before piping.
- `191836`: mark resolved; record that `core.excludesFile=NUL` is invalid here and that `.gitignore` is the safe repository-local diagnostic override. State that the earlier clean count was discarded.
- `192219`: mark contained; record that exact-file elevated staging and design-only commit `3ecacc6` succeeded without staging unrelated changes.
- `192241`: mark resolved; record removal of the date-line trailing spaces and successful `git diff --cached --check` before commit `3ecacc6`.

Do not add provider identifiers, payloads, credentials, or secrets to any incident.

- [ ] **Step 6: Validate the tracked documentation changes**

Run:

```powershell
pnpm.cmd docs:check
git -c core.excludesFile=.gitignore diff --check -- docs/operations/setbacks/incidents
```

Expected: documentation coverage passes and Git reports no whitespace errors.

- [ ] **Step 7: Commit only the resolved evidence records**

Before staging, require an empty existing index. Then stage exactly the seven incident files listed in this task, verify the staged name set, and commit:

```powershell
git commit -m "docs: resolve Phase B controller validation setbacks"
```

Expected: one documentation-only commit containing exactly those seven incident files. Candidate deployment remains unstarted and requires separate explicit authorization.
