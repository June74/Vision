# SB-20260727-202411-node-repl-neon-fetch-blocked: Node browser-control runtime could not fetch Neon

- **Status:** contained
- **First observed:** 2026-07-27T20:24:11Z
- **Last observed:** 2026-07-27T23:50:53.9431104Z
- **Phase/task:** Listener-first restore retry Task 2
- **Environment:** Persistent Node browser-control runtime
- **Version/commit:** `4420f6d`

## Symptom

The private disposable-target URL passed closed shape validation, but the
direct Neon query failed with a generic fetch error before returning rows.

## Impact

No SQL result was obtained and no database mutation was attempted. The private
URL was not printed.

## Reproduction conditions

Use the signed-in provider control to select the retained non-primary target
and restricted application role, acquire the connection value only into the
same temporary Node-backed process, create the repository-installed Neon pool
with a maximum of one connection, and request one retained client.

## Safe evidence

The driver package loaded, the restricted role gate passed, and the private
connection value passed closed shape validation. The retained client failed to
connect before any SQL or transaction attempt. Partial driver resources were
closed, private references were removed, Chrome was finalized, and the Node
kernel was reset.

## Attempts and outcomes

- The amended in-memory driver path was attempted once.
- No retry, alternate transport, SQL execution, deployment, secret change, or
  branch action occurred.
- Fail-closed cleanup completed before setback logging.

## Cause classification

- **Confirmed cause:** The Node browser-control runtime cannot reach the Neon
  endpoint through its network boundary.
- **Hypotheses:** The current retained-client failure is a recurrence of the
  already confirmed runtime network boundary.
- **Rejected hypotheses:** The driver package was not missing, the application
  role gate did not fail, and no SQL precondition rejected the target because
  SQL was never reached.
- **Known exclusions:** URL syntax, application role, nonempty password, and
  required SSL parameters all passed closed validation.

## Correction and prevention

- **Correction:** The earlier shell bridge completed its separately authorized
  read-only diagnosis. It is prohibited by the amended Task 2 in-memory-only
  boundary and was not reused.
- **Prevention:** Keep Task 2 blocked until an authorized temporary in-memory
  runtime can both receive the provider value without persistence or output
  and reach the Neon endpoint. Do not retry the current browser-control Node
  runtime without a reviewed network-boundary change.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish a safe, non-secret connectivity probe for
  the approved in-memory runtime boundary before another target operation is
  authorized.

## Verification and related work

The approved shell network path returned the closed aggregate result. The
short-lived bridge file was verified inside the system temp directory, used
only in one process, deleted in `finally`, and confirmed absent. No URL or
credential value entered the repository or output.

The amended Task 2 recurrence performed all required cleanup and left the
database unchanged at the previously verified aggregate.

## Recurrence history

- 2026-07-27T20:24:11Z: First observed during the read-only diagnosis.
- 2026-07-27T20:28:07Z: The separately authorized shell path completed the
  read-only check and the incident was closed.
- 2026-07-27T23:50:53.9431104Z: Recurred through the newly approved in-memory
  Neon pool path. Retained-client connection failed before SQL; all private
  references and driver/browser resources were closed, the Node kernel was
  reset, and no database mutation occurred. The incident remains contained
  because the former shell bridge is prohibited for this task.
