# SB-20260803-011334-cloudflare-add-button-ancestor-too-broad: Cloudflare Add-button ancestor selector matched two sections

- **Status:** closed
- **First observed:** 2026-08-03T01:13:34.1320971Z
- **Last observed:** 2026-08-03T01:15:35.0880595Z
- **Phase/task:** Phase B preview AI secret owner handoff
- **Environment:** Signed-in Cloudflare Worker settings page
- **Version/commit:** Candidate `c1911f8`; live preview still on rollback

## Symptom

The temporary DOM marker intended for the `Variables and secrets` Add button
matched both page-level Add buttons because the ancestor walk accepted any
later matching heading.

## Impact

The selector failed closed before clicking. No form opened and no Worker,
secret, deployment, schedule, key, or provider state changed.

## Reproduction conditions

On a page with Add buttons in both `Variables and secrets` and `Trigger events`,
search every ancestor for a variables heading instead of stopping at the first
section heading.

## Safe evidence

Only the fixed match count of two was emitted. No URL, identifier, credential
name/value pair, or provider response was exposed.

## Attempts and outcomes

- The broad ancestor predicate returned two and threw before interaction.
- The correction will use the first/nearest heading exactly as the successful
  read-only inventory did.

## Cause classification

- **Confirmed cause:** The marking predicate was broader than the preceding
  section-context inventory.
- **Known exclusions:** No ambiguous click or external mutation occurred.

## Correction and prevention

- **Correction:** Stop at the first ancestor that contains a section heading
  and accept the button only when that nearest heading is exact.
- **Prevention:** Use the identical context predicate for inventory and action;
  require a unique count before every click.
- **Owner:** Codex.
- **Next diagnostic step:** Retry the exact nearest-heading predicate once.

## Verification and related work

The exact two-button count and section-to-index mapping were reconfirmed. The
unique variables-section button opened the add-variable drawer, whose variable
name, value, Secret option, and Deploy controls were present. No value was read
or entered.

## Recurrence history

- 2026-08-03T01:13:34.1320971Z: First observed and contained before clicking.
- 2026-08-03T01:15:35.0880595Z: Corrected with the verified section index and
  closed after the intended drawer opened.
