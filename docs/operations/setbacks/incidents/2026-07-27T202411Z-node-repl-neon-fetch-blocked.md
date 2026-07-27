# SB-20260727-202411-node-repl-neon-fetch-blocked: Node browser-control runtime could not fetch Neon

- **Status:** closed
- **First observed:** 2026-07-27T20:24:11Z
- **Last observed:** 2026-07-27T20:28:07Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Persistent Node browser-control runtime
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The private disposable-target URL passed closed shape validation, but the
direct Neon query failed with a generic fetch error before returning rows.

## Impact

No SQL result was obtained and no database mutation was attempted. The private
URL was not printed.

## Cause classification

- **Confirmed cause:** The Node browser-control runtime cannot reach the Neon
  endpoint through its network boundary.
- **Known exclusions:** URL syntax, application role, nonempty password, and
  required SSL parameters all passed closed validation.

## Correction and prevention

- **Correction:** Transfer the already visible connection snippet through the
  system clipboard into one approved shell process, validate it in memory, run
  the read-only aggregate query, and print only closed counts/booleans.
- **Prevention:** Use the shell network boundary for direct provider database
  diagnostics instead of the browser-control Node runtime.

## Verification and related work

The approved shell network path returned the closed aggregate result. The
short-lived bridge file was verified inside the system temp directory, used
only in one process, deleted in `finally`, and confirmed absent. No URL or
credential value entered the repository or output.
