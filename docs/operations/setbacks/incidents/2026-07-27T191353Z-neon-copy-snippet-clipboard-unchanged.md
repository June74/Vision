# SB-20260727-191353-neon-copy-snippet-clipboard-unchanged: Neon Copy snippet left browser clipboard unchanged

- **Status:** closed
- **First observed:** 2026-07-27T19:13:53Z
- **Last observed:** 2026-07-27T19:15:05Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon connection modal
- **Version/commit:** `9bbc4be`

## Symptom

The unique Copy snippet control left the browser clipboard at its prior
non-secret query value instead of copying the selected connection string.

## Impact

The disposable database URL was not captured and no temporary Cloudflare
secret was written. No password or URL was exposed.

## Reproduction conditions

Select the application role in the fresh connection modal and activate its
unique Copy snippet control.

## Safe evidence

The clipboard remained 84 characters and failed every database-URL shape
check. The content itself was not returned.

## Attempts and outcomes

- The selected role changed from owner to the application role.
- Copy snippet did not update the browser clipboard.
- Repetition of the same copy control stopped.

## Cause classification

- **Confirmed cause:** The clipboard did not receive the connection value.
- **Hypotheses:** Browser clipboard integration may not receive this
  provider-side copy action.
- **Rejected hypotheses:** The clipboard did not contain a masked or malformed
  database URL; it remained the prior query.
- **Known exclusions:** No secret, password, URL, target identity, or protected
  value was emitted.

## Correction and prevention

- **Correction:** Read the connection field directly inside browser memory
  after proving the selected role, without emitting its contents.
- **Prevention:** Verify clipboard shape after every provider copy action and
  never trust a copy control or toast alone.
- **Owner:** Codex.
- **Next diagnostic step:** Locate the single connection field and validate its
  full private value in memory.

## Verification and related work

A fresh connection modal exposed one valid application-role URL directly to
browser memory. Only fixed shape booleans and length were returned.

## Recurrence history

- 2026-07-27T19:13:53Z: First observed and contained without state change.
- 2026-07-27T19:15:05Z: Closed after the validated connection field was read
  directly without using the clipboard action.
