# SB-20260727-192412-cloudflare-add-mis-scoped: Cloudflare Add control opened Trigger events instead of Variables and secrets

- **Status:** closed
- **First observed:** 2026-07-27T19:24:12Z
- **Last observed:** 2026-07-28T02:59:00Z
- **Phase/task:** Preview database role probe Task 2 Step 2
- **Environment:** Cloudflare preview dashboard
- **Version/commit:** `9bbc4be`

## Symptom

An `Add` control selected by page-wide DOM order opened the Trigger events
dialog instead of the Variables and secrets editor.

## Impact

No trigger, variable, secret, deployment, or other provider state was created
or changed. The unrelated dialog remained open until it could be closed
explicitly.

## Cause classification

- **Confirmed cause:** The page contains multiple identically named `Add`
  controls, and the page-wide ordinal did not preserve the intended section
  association.
- **Known exclusions:** No confirmation or create action was submitted.

## Correction and prevention

- **Immediate containment:** Stop before interacting with the dialog and verify
  its heading.
- **Correction:** Close the Trigger events dialog, then identify the intended
  control from the unique Variables and secrets heading container.
- **Prevention:** Never select a repeated dashboard action by page-wide ordinal;
  bind it to its section header or a verified section-local bounding box.

## Verification and related work

The Trigger events dialog was dismissed without submitting any action. The
Variables and secrets control will be selected from its verified section-local
header rather than by page-wide ordinal.

## Recurrence history

- 2026-07-28T02:59:00Z: An ambiguous account-level Settings control was opened
  instead of the preview Worker settings route. Safe route classification
  detected the mismatch before any form interaction. Navigation returned to
  the verified Worker route and no provider state changed.
