# TSX Native Adapter Repair Design

Date: 2026-08-03
Status: User-approved design

## Context

The repaired Phase B redeployment controller reached the live baseline schedule check and accepted fresh, user-confirmed Cloudflare schedule evidence. It then stopped with `native_process_adapter_resolution_failed` before completing read-only rollback validation.

The failure is deterministic and local. `Assert-ProviderBindings` invokes `node_modules\.bin\tsx.cmd` to run `scripts/validate-preview-deploy-config.ts`. `Resolve-NativeProcessAdapter` has explicit adapters for `wrangler.cmd` and `pnpm.cmd`, rejects every other batch launcher, and therefore rejects the controller's own TSX invocation. The current tests do not cover this path.

No candidate deployment or provider mutation occurred during the failed validation.

## Goals

- Permit the controller's known TSX validator through an explicit, fail-closed adapter.
- Launch TSX through Node directly, without `cmd.exe` or a general batch-file escape hatch.
- Preserve command arguments exactly, including empty, Unicode, quoted, and multiline values.
- Preserve the rejection of every unapproved `.cmd` and `.bat` launcher.
- Prove the repair locally before another read-only Cloudflare validation.

## Non-goals

- Do not permit arbitrary Windows batch launchers.
- Do not change deployment, rollback, provider-binding, schedule-evidence, or secret-handling contracts.
- Do not deploy or mutate Cloudflare as part of this repair.
- Do not rotate, read, or print any key, token, credential, provider payload, identifier, or secret value.

## Approaches Considered

### 1. Explicit centralized TSX adapter — selected

Recognize only the `tsx.cmd` leaf name in `Resolve-NativeProcessAdapter`, resolve `node.exe`, resolve the artifact-local `node_modules\tsx\dist\cli.mjs`, prepend that entrypoint to the existing argument list, and execute through the existing bounded native-process runner.

This keeps all launcher policy in one place and retains the controller's fail-closed behavior.

### 2. Direct Node invocation at the validator call site

Change only `Assert-ProviderBindings` to call Node and the TSX entrypoint directly. This is a smaller edit, but it bypasses the centralized adapter policy and makes future auditing harder.

### 3. General batch-launcher support

Allow arbitrary `.cmd` and `.bat` files through `cmd.exe`. This is rejected because it expands the execution surface and reintroduces shell quoting and command-injection risk.

## Design

`Resolve-NativeProcessAdapter` will add one explicit branch for `tsx.cmd`:

1. Resolve `node.exe` through the existing executable lookup.
2. Resolve `node_modules\tsx\dist\cli.mjs` beneath the supplied artifact working directory.
3. Return Node as the executable and prepend the TSX entrypoint to the caller's unchanged arguments.
4. Keep Wrangler-only bootstrap behavior disabled for TSX.
5. Keep the existing catch boundary so a missing Node runtime or TSX entrypoint is classified as `native_process_adapter_resolution_failed`.

The generic `.cmd` and `.bat` rejection branch remains after the three explicit adapters: Wrangler, pnpm, and TSX.

## Error Handling and Security

- A missing or unresolvable TSX entrypoint fails closed before process startup.
- Unknown batch launchers continue to fail closed.
- No shell is introduced.
- Existing timeout, output-size, process-tree cleanup, and sanitized-result behavior remains unchanged.
- Tests and live validation may report only allowlisted outcome categories and booleans; raw provider responses and sensitive values remain hidden.

## Test Design

Testing will be test-first:

1. Add a failing adapter regression test proving `tsx.cmd` resolves to Node plus the artifact-local TSX entrypoint.
2. Prove original arguments are preserved for difficult Windows values.
3. Prove a missing TSX entrypoint produces the existing safe adapter-resolution category.
4. Prove an unknown `.cmd` or `.bat` launcher is still rejected.
5. Run the complete native-controller suite, including timeout, capture, output-limit, cleanup, process API, argument, bounded JSON, rollback uncertainty, correlation, and source-scope checks.
6. Obtain an independent read-only review of the patch and tests.

## Operational Validation

After local tests and review pass, run `validate_current_rollback` with normal saved Wrangler authentication and no `XDG_CONFIG_HOME` override. The run remains read-only and requires a fresh nonce-bound confirmation of the two existing Cloudflare cron schedules.

A successful result must report `current_rollback_valid: true` through the controller's sanitized output contract. Candidate deployment remains a separate, later action requiring explicit authorization.

## Acceptance Criteria

- The new TSX regression test fails before the implementation and passes afterward.
- The full native-controller suite passes.
- Unknown batch launchers remain rejected.
- Independent review reports no Critical or Important findings.
- Read-only live rollback validation succeeds without provider mutation or sensitive output.
