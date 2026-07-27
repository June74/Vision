# SB-20260727-191127-partial-database-uri-fragment-output: Redacted modal output exposed a masked database URI fragment

- **Status:** contained
- **First observed:** 2026-07-27T19:11:27Z
- **Last observed:** 2026-07-27T19:11:27Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon connection modal
- **Version/commit:** `9bbc4be`

## Symptom

A supposedly redacted connection-modal excerpt still returned a masked,
partial database URI fragment.

## Impact

The output included connection structure and non-secret routing metadata. It
did not include a password, complete database URL, token, target identity,
branch identifier, or protected row.

## Reproduction conditions

Redact only complete URL tokens even though the provider's accessibility
snapshot splits one URI across multiple lines.

## Safe evidence

The returned fragment showed a masked password and an incomplete host. The
actual fragment is intentionally not copied into this incident.

## Attempts and outcomes

- The broad modal excerpt was stopped immediately.
- No further modal text or URI component will be emitted.
- Connection values remain in browser memory only and are verified through
  fixed booleans and lengths.

## Cause classification

- **Confirmed cause:** Line-local URL redaction did not cover a URI split
  across accessibility-snapshot lines.
- **Hypotheses:** None open.
- **Rejected hypotheses:** No cleartext password or complete connection URL was
  returned.
- **Known exclusions:** No credential or provider state changed.

## Correction and prevention

- **Correction:** Stop all modal text output and project only fixed booleans.
- **Prevention:** Treat every connection-modal line as sensitive regardless of
  masking; never emit redacted excerpts from secret-bearing widgets.
- **Owner:** Codex.
- **Next diagnostic step:** Capture the selected application-role URL directly
  in browser memory and verify only its scheme, role class, and length.

## Verification and related work

The incident remains contained until the temporary secret transfer completes
without additional connection output and the partial fragment is absent from
repository files.

## Recurrence history

- 2026-07-27T19:11:27Z: First observed, contained, and disclosed to the user.
