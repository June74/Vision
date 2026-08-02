# SB-20260801-221013-task7-task5-frozen-long-decimal-literal: Frozen privacy scan found one long decimal literal

- **Status:** closed
- **First observed:** 2026-08-01T22:10:13.5294390Z
- **Last observed:** 2026-08-01T22:14:59.3558572Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 repaired snapshot privacy scan
- **Environment:** Five-file byte-verified ignored review snapshot
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The counts-only privacy scan found zero URLs, zero email addresses, zero literal 64-hex values, and one literal 16-to-20 digit decimal number.

## Impact

The Task 5 snapshot cannot be handed to the reviewer until the literal is classified without rendering it. No provider, network, browser, deployment, database, calendar, object storage, authentication flow, credential, secret, key, backup key, stage, commit, or push was accessed or changed.

## Reproduction conditions

Scan only the five frozen Task 5 files for a standalone decimal literal in the provider-reference width. Report only file and line metadata during diagnosis, never the matched value.

## Safe evidence

The scan returned exactly one long-decimal match; the value and containing line were not printed.

## Attempts and outcomes

- The repaired files were copied into a new snapshot and byte-verified with five files and zero mismatches.
- The first counts-only privacy scan stopped review admission on the single long-decimal match.
- A metadata-only locator identified one controller-test line without rendering the value.
- The first guarded rewrite assumed the synthetic canary was exactly two above JavaScript's safe-integer maximum. The guard disproved that assumption and blocked the patch before any file changed.
- A second guarded probe showed the canary is not a small positive offset above that maximum; it made no edit and did not render the value.
- A category-only probe also showed the canary is not one of the checked standard integer boundaries. The value remained unrendered and the source unchanged.
- The synthetic canary was replaced by a runtime-derived beyond-safe-integer boundary. The corrected five-file source scan returned zero for all four privacy counters, the focused suites passed 99 of 99 tests, and both TypeScript projects passed typecheck.

## Cause classification

- **Confirmed cause:** One frozen source line contains a standalone long decimal literal.
- **Hypotheses:** It is synthetic test data that should be assembled at runtime from its small safe offset instead of retained literally.
- **Rejected hypotheses:** No URL, email, or literal 64-hex leak exists in the same snapshot.
- **Known exclusions:** No live/provider value has been printed or read.

## Correction and prevention

- **Correction:** Locate only file and line metadata, classify the source, replace provider-shaped synthetic literals with assembled test data if applicable, rerun tests, refreeze, and repeat the counts-only scan.
- **Prevention:** Include long standalone decimal literals in every privacy-safe frozen-package scan.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Return only the frozen filename and line number for the one match.

## Verification and related work

Closed after safe classification, runtime derivation, zero-count privacy scanning, 99 passing focused tests, and zero-diagnostic typecheck. A new byte-verified snapshot is still required before independent review.

## Recurrence history

- 2026-08-01T22:10:13.5294390Z: First recorded after the repaired-snapshot privacy scan.
- 2026-08-01T22:12:13.8922933Z: The exact-binding guard rejected the first offset assumption before editing the source.
- 2026-08-01T22:12:47.3020500Z: The bounded offset probe rejected the second assumption without editing or exposing the value.
- 2026-08-01T22:13:25.1805097Z: The category-only standard-boundary probe returned nonstandard without editing or exposing the value.
- 2026-08-01T22:14:59.3558572Z: Closed after the runtime-derived canary passed privacy, focused-test, and type gates.
