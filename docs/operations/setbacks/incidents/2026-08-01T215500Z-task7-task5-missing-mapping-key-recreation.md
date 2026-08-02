# SB-20260801-215500-task7-task5-missing-mapping-key-recreation: Missing mapping key could be silently recreated

- **Status:** closed
- **First observed:** 2026-08-01T21:55:00Z
- **Last observed:** 2026-08-01T22:05:35.5224770Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 post-repair inspection
- **Environment:** Ignored local provider driver and contained provider-stub self-test
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The shared mapping-key helper uses exclusive creation whenever the authenticator file is absent. Resolution calls that same helper, so deleting the key while retained mappings exist would create a new key and only then reject the opaque token.

## Impact

The command still fails closed, but the driver violates the approved nonrotation contract by silently replacing key state during resolution. The retained mappings then become permanently unusable, and later dispatches would use a different key. No key value, backup key, provider, network, browser, deployment, database, calendar, object storage, authentication flow, commit, stage, or push was accessed or changed.

## Reproduction conditions

Create a contained mapping, remove only its local mapping-authenticator file, and attempt token resolution through candidate attribution. The attempt must fail with empty streams, must not recreate the key, and must not invoke the provider stub.

## Safe evidence

Read-only source inspection showed `resolveMapping` calling the create-or-read helper. No private value, mapping value, provider identifier, opaque token, digest, or raw process output is recorded.

## Attempts and outcomes

- Root inspected the post-review-repair driver before freezing it for independent review.
- The issue was found before any live action and before the repaired snapshot was accepted.
- Resolution now reads only an existing authenticator. Mapping creation is preflighted before provider work and may initialize the authenticator only when no retained mapping exists.
- The contained RED completed 51 assertions with 49 passing and only the two planned missing-key categories failing.
- A report-only append used a stale final-line anchor and changed no file. The exact report tail was inspected before retry; this documentation mismatch did not affect the contained test or driver.

## Cause classification

- **Confirmed cause:** Key initialization and key resolution share one helper with create-if-absent behavior.
- **Hypotheses:** None remain for this incident.
- **Rejected hypotheses:** This is a backup-key rotation or external credential issue; the mapping authenticator is separate, local, ignored state.
- **Known exclusions:** No tracked workflow contract or permanent acceptance-context schema needs to change.

## Correction and prevention

- **Correction:** Added contained key-loss regressions, separated read-only resolution from initialization, rejected initialization when retained mappings exist, and preflighted mapping creation before provider work.
- **Prevention:** Test deletion and corruption of local key material while mappings exist, not only normal persistence and malformed length.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident; the broader Task 5 snapshot still requires its scheduled independent review.

## Verification and related work

The focused RED completed 51 assertions with 49 passing and only the 2 planned missing-key categories failing. The final complete contained suite passed 54 of 54 assertions. Both ignored JavaScript modules passed `node --check`. The regression proves resolution and new dispatch both fail with empty streams, retain the mapping, leave the key absent, and make no provider call after key loss. No live system, credential, secret, key value, backup key, Git state, or external service was accessed or changed.

## Recurrence history

- 2026-08-01T21:55:00Z: First recorded during root post-repair source inspection.
- 2026-08-01T22:05:35.5224770Z: Closed after contained RED/GREEN and both syntax checks.
