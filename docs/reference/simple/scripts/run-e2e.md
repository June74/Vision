# `scripts/run-e2e.ts`

This script runs Vision's browser tests with a local server it owns and closes itself. It prevents a finished Windows test run from waiting forever for another shell to stop.

## `normalizePlaywrightArguments`

Removes the package command's separator while keeping file filters and all other Playwright choices.

## `runManagedE2e`

Starts the local server, runs Playwright, closes the server even after failure, checks that the port is free, and returns the browser tests' result.

## `startViteServer`

Starts Vite inside the runner in test mode on the fixed local browser-test address.

## `close`

Closes the in-process Vite server, its watchers, and its sockets.

## `closeFailedViteServer`

Cleans up a Vite server that could not finish starting.

## `runPlaywrightCli`

Starts Playwright directly with Node, without a command shell.

## `waitForPlaywrightExit`

Waits for Playwright's result and handles an interruption without changing a normal exit code.

## `requestStop`

Records an interruption and begins cleanup of the owned Playwright process.

## `interrupt`

Handles a keyboard interruption.

## `terminate`

Handles an external stop request.

## `terminateOwnedProcess`

Stops only the Playwright process started by this runner, including descendants if a forced cleanup is required.

## `waitForOwnedExit`

Waits a limited time for one owned process to finish.

## `onExit`

Finishes the bounded process wait when the owned child exits.

## `forceKillOwnedProcess`

Uses the exact owned process ID or process group when graceful cleanup times out.

## `verifyPortReleased`

Checks that the browser-test server port is free after shutdown.

## `isPortListening`

Tests whether the exact local browser-test address still accepts a connection.

## `finish`

Closes one port probe and reports its result.

## `delay`

Waits briefly between port-release checks without blocking interruptions.

## `signalExitCode`

Turns an interruption into the conventional nonzero command result.

## `main`

Runs the production lifecycle and returns a safe failure result if setup or cleanup cannot complete.

## `isMainModule`

Keeps the script importable by tests while running it normally from the package command.
