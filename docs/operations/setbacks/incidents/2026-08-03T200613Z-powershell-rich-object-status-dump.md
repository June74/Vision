# SB-20260803-200613-powershell-rich-object-status-dump: Status probe serialized PowerShell rich objects instead of strings

- **Status:** closed
- **First observed:** 2026-08-03T20:06:13.813845Z
- **Last observed:** 2026-08-06T23:13:08.7657509Z
- **Phase/task:** Phase B completion audit and live-acceptance preparation
- **Environment:** Local Windows PowerShell status probe
- **Version/commit:** Review helper only; no provider mutation

## Symptom

A combined JSON status probe passed Select-String result objects directly into ConvertTo-Json, recursively serializing PowerShell provider metadata and producing a large truncated diagnostic dump. This is a recurrence of the same scalar-projection defect.

## Impact

No files or external state changed and no provider data or secrets were present, but the intended compact status could not be read reliably and the tool output was unnecessarily noisy.

## Reproduction conditions

Serialize only explicit scalar status fields instead of piping provider objects
or rich PowerShell records into JSON.

## Safe evidence

Only the safe fact that an oversized diagnostic was produced was retained; no
provider data or secret was emitted.

## Attempts and outcomes

- The rich-object serialization was identified as a probe-only defect.
- The recurrence was stopped before any external action; a scalar-only replacement probe is required before closing it again.

## Cause classification

- **Confirmed cause:** PowerShell rich objects were serialized without first
  selecting scalar status fields.
- **Hypotheses:** None.
- **Rejected hypotheses:** Provider output was not the cause.
- **Known exclusions:** No files, provider state, credentials, or keys changed.

## Correction and prevention

- **Correction:** Select explicit booleans, counts, categories, and lengths
  before JSON serialization; rerun the audit with strings only.
- **Prevention:** Keep status probes scalar-only and bounded, and never include
  whole `Select-String`, `Get-Item`, or provider objects in a JSON payload.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; later privacy-safe probes and local gates
  passed.

## Verification and related work

The prior occurrence was closed by bounded status probes and the passing local
verification suite. The replacement scalar-only audit completed with only
allowlisted counts and no external action.

## Recurrence history

- 2026-08-03T20:06:13.813845Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after scalar-only status output and
  bounded verification passed.
- 2026-08-06T23:12:27.1221998Z: Recurrence during the Phase B completion audit;
  no external action or secret exposure; incident contained pending scalar
  replacement probe.
- 2026-08-06T23:13:08.7657509Z: Scalar-only replacement probe completed;
  incident closed.
