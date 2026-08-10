# SB-20260803-213330-powershell-probe-array-argument-binding: Read-only probe passed command arguments without named array binding

- **Status:** closed
- **First observed:** 2026-08-03T21:33:30.810714Z
- **Last observed:** 2026-08-03T21:39:36.4134641Z
- **Phase/task:** Phase B candidate deployment failure diagnosis
- **Environment:** Approved outside-sandbox response-discarding Wrangler probes in Windows PowerShell 5.1
- **Version/commit:** diagnostic only; no product or provider mutation

## Symptom

The binding and R2 probe invoked its capture helper with positional array syntax, so the intended Wrangler JSON arguments were not bound as one string array and date parsing failed.

## Impact

No provider mutation occurred and no private value was emitted; the read-only diagnosis was delayed until the helper calls were corrected to use the named Arguments parameter.

## Reproduction conditions

Wrap Wrangler JSON output in a custom helper, bind its command array
positionally, and immediately parse assumed deployment or version timestamp
fields without first validating the decoded schema or using `TryParse`.

## Safe evidence

Both malformed probes stopped at date parsing. Schema-only follow-ups reported
valid JSON arrays and fixed property names without returning any values.

## Attempts and outcomes

1. Positional array binding plus an assumed deployment shape failed at date
   parsing.
2. Naming the array parameter did not repair the helper's output-shape
   assumption, so that helper was abandoned.
3. A direct response-discarding deployment probe succeeded.
4. The first versions attribution probe also used strict `Parse` logic and
   failed; a schema-only read followed by `TryParse` completed successfully and
   proved zero versions were created during the controller run.

## Cause classification

- **Confirmed cause:** The diagnostic wrappers coupled command invocation and
  JSON parsing to unverified PowerShell result shapes and used exception-throwing
  timestamp parsing at the boundary.
- **Hypotheses:** None remaining for these probe failures.
- **Rejected hypotheses:** Wrangler returned invalid JSON or invalid version
  timestamps; provider deployment state was corrupt.
- **Known exclusions:** No provider mutation, credential output, identifier
  output, private payload, or source edit occurred.

## Correction and prevention

- **Correction:** Use direct captured invocations, inspect schema keys/counts
  first, and use `DateTimeOffset.TryParse` before comparing timestamps.
- **Prevention:** Response-discarding probes must validate their decoded shape
  explicitly and must not introduce a convenience wrapper until its output
  contract has a local test.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Corrected direct probes completed with JSON decoding, tolerant timestamps, and
only allowlisted counts/booleans in their output.

## Recurrence history

- 2026-08-03T21:33:30.810714Z: First observed.
- 2026-08-03T21:39:36.4134641Z: Corrected deployment and version probes
  verified; incident closed.
