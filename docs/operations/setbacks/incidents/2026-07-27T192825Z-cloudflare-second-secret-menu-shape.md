# SB-20260727-192825-cloudflare-second-secret-menu-shape: Second Cloudflare Secret option was not exposed through the first row menu structure

- **Status:** closed
- **First observed:** 2026-07-27T19:28:25Z
- **Last observed:** 2026-07-27T19:28:25Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Cloudflare preview dashboard
- **Version/commit:** `9bbc4be`

## Symptom

After staging the second unsaved secret row and clicking its type selector, a
search for a visible Secret label with option ancestry returned no match even
though that structure worked for the first row.

## Impact

Both secret rows remain unsaved. No value was printed and no provider mutation
was submitted, but the second row cannot be accepted until its Secret type is
positively confirmed.

## Cause classification

- **Working hypothesis:** The second selector did not open, or Cloudflare used a
  different menu state/structure after the first row was changed.
- **Known exclusions:** The second name and value fill operations completed
  before the closed menu-shape query.

## Correction and prevention

- **Immediate containment:** Do not deploy the form with the default Text type.
- **Correction:** Inspect only the selector's expanded state and safe role
  structure, then select and verify Secret without returning form values.
- **Prevention:** Re-resolve each dynamically added row instead of assuming
  identical portal state from an earlier row.

## Verification and related work

The selector was confirmed expanded with one listbox and three role-resolved
options. The unique Secret option was selected, and the second row's combobox
then reported `Secret`. The initial absence was transient; the exact portal
mount timing was not independently established.
