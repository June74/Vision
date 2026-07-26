# `scripts/run-e2e.ts`

The canonical E2E runner replaces Playwright's shell-owned `webServer` lifecycle. It keeps Vite in the parent Node process, launches the Playwright CLI as one exact child without `shell`, closes Vite in `finally`, polls the fixed port until released, and preserves the test process exit code. This avoids an unbounded Windows `taskkill`/shell-close teardown boundary while retaining Linux CI behavior.

## `normalizePlaywrightArguments`

**Signature:** `normalizePlaywrightArguments(arguments_): readonly string[]`

Removes one leading literal `--` supplied by the package-manager invocation. Every file selector, grep, reporter, and other Playwright argument remains ordered and unchanged.

## `runManagedE2e`

**Signature:** `runManagedE2e(arguments_, dependencies?): Promise<number>`

Starts the managed server, delegates the normalized arguments to Playwright, and closes the server plus verifies port release in a `finally` block. A Playwright nonzero code is returned unchanged; thrown startup, execution, or cleanup failures reject for `main` to report as `1`.

## `startViteServer`

Creates Vite programmatically from the repository config in `test` mode, which excludes the Cloudflare development plugin. It binds strictly to `127.0.0.1:5173`, so it never adopts or terminates an unrelated server.

## `close`

Awaits Vite's own close method, covering the HTTP listener, file watchers, and in-process plugin lifecycle.

## `closeFailedViteServer`

Best-effort closes a partially initialized Vite instance while preserving the original startup exception.

## `runPlaywrightCli`

Resolves `@playwright/test/cli`, launches it with the current Node executable, `shell: false`, inherited standard streams, repository working directory, and the managed base URL. POSIX creates an owned process group; Windows retains the exact child PID for bounded tree cleanup.

## `waitForPlaywrightExit`

Registers temporary SIGINT/SIGTERM handlers, waits for child error or exit, removes handlers in `finally`, returns the exact numeric normal exit, and converts a handled interruption to a conventional nonzero code.

## `requestStop`

Records only the first signal and invokes bounded cleanup for the exact owned Playwright child.

## `interrupt`

Maps the parent SIGINT handler to `requestStop`.

## `terminate`

Maps the parent SIGTERM handler to `requestStop`.

## `terminateOwnedProcess`

Requests SIGTERM, waits three seconds, then delegates to exact-tree forced cleanup and verifies exit. It never scans or kills unrelated Node processes.

## `waitForOwnedExit`

Observes an already-exited child immediately or races its exact exit event against a bounded timer.

## `onExit`

Clears the timer and resolves the exact-child wait.

## `forceKillOwnedProcess`

On POSIX, signals only the detached Playwright process group. On Windows, launches `taskkill` without a shell for the exact owned PID and `/T`; that cleanup command is itself bounded and hidden.

## `verifyPortReleased`

Polls the fixed test address for at most five seconds after Vite closes and throws if a listener remains.

## `isPortListening`

Uses one short-lived TCP connection to the fixed loopback address and destroys the socket on connect, error, or timeout.

## `finish`

Removes probe listeners, destroys the socket, and resolves exactly once with the connection result.

## `delay`

Uses an asynchronous timer for port polling.

## `signalExitCode`

Returns `128 + signal number` for SIGINT or SIGTERM.

## `main`

Passes command-line arguments into the production lifecycle, assigns its exit code, and maps thrown lifecycle errors to a concise standard-error message plus exit `1`.

## `isMainModule`

Compares normalized file URLs so Vitest can import lifecycle functions without executing the command entry point.
