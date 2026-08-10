# SB-20260802-230358-browser-evaluate-dom-constructor-unavailable: Browser evaluator omitted a DOM constructor

- **Status:** closed
- **First observed:** 2026-08-02T23:03:58.4527618Z
- **Last observed:** 2026-08-02T23:03:58.4527618Z
- **Phase/task:** Phase B OAuth reconnect Task 5 rollback schedule verification
- **Environment:** Read-only signed-in Cloudflare dashboard inspection
- **Version/commit:** Rolled-back preview at the approved rollback commit

## Symptom

A bounded DOM projection used `HTMLAnchorElement` to classify a navigation
element, but that constructor is unavailable in the restricted evaluator.

## Impact

The local projection failed before returning element metadata. No click,
navigation, Cloudflare setting, deployment, schedule, or project state
changed.

## Reproduction conditions

Use a browser DOM constructor as an `instanceof` operand inside the restricted
page evaluator.

## Safe evidence

Only the missing-constructor error category was rendered. Dashboard content,
links, account data, and provider identifiers were not returned.

## Attempts and outcomes

- The evaluator found candidate elements before failing during projection.
- No interactive action followed the incomplete result.

## Cause classification

- **Confirmed cause:** The evaluator does not expose `HTMLAnchorElement`.
- **Hypotheses:** None.
- **Rejected hypotheses:** Cloudflare navigation failure was not evaluated.
- **Known exclusions:** No external or repository mutation occurred.

## Correction and prevention

- **Correction:** Inspect `tagName` and attributes directly without browser
  constructor globals.
- **Prevention:** Use only basic DOM reads documented for the restricted
  evaluator.
- **Owner:** Codex.
- **Next diagnostic step:** Repeat the bounded projection with tag-name checks.

## Verification and related work

The corrected projection used `tagName` and attributes directly and returned
one unique Workers anchor summary containing only safe tag, role, href-presence,
keyword, and segment-count facts.
