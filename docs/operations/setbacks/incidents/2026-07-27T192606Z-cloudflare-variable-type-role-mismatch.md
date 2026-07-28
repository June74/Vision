# SB-20260727-192606-cloudflare-variable-type-role-mismatch: Cloudflare variable type selector role did not match its visible button

- **Status:** closed
- **First observed:** 2026-07-27T19:26:06Z
- **Last observed:** 2026-07-28T14:04:00Z
- **Phase/task:** Preview database role probe Task 2 final transfer test
- **Environment:** Cloudflare preview dashboard
- **Version/commit:** `9bbc4be`

## Symptom

The Variables and secrets editor contained a visible `Text` control, but an
exact accessibility-role query for a button named `Text` returned no match.

## Impact

No secret name or value had been entered, and no provider state was saved.
The mismatch delayed selecting the required Secret type.

## Cause classification

- **Confirmed cause:** The control's visible DOM element and the browser
  automation accessibility role are not equivalent.
- **Known exclusions:** The intended secret editor is open and its name and
  value fields are uniquely resolved.

## Correction and prevention

- **Immediate containment:** Do not enter any value until the type control is
  positively identified.
- **Correction:** Resolve the selector by its verified role or section-local DOM
  structure and confirm `Secret` is selected before entering values.
- **Prevention:** Query role counts before acting on dashboard controls whose
  visual element type may be overridden by accessibility semantics.

## Verification and related work

The effective control was uniquely identified as a combobox. Its portal-backed
Secret option was identified through the option/listbox ancestry, clicked once,
and the combobox then reported `Secret`.

## Recurrence history

- 2026-07-28T14:04:00Z: The resumed Worker editor again exposed visible `Text`
  without the same accessible button name. A bounded editor button map located
  the type selector before interaction. When opened, a global exact-text
  Secret locator included hidden duplicates; the one visible semantic option
  was scoped by role and selected once. No value had been pasted and no
  provider mutation occurred.
