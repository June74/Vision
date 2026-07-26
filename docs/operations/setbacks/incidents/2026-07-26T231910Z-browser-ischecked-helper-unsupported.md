# SB-20260726-231910-browser-ischecked-helper-unsupported: Browser isChecked helper unsupported

- **Status:** closed
- **First observed:** 2026-07-26T23:19:10Z
- **Last observed:** 2026-07-26T23:19:10Z
- **Phase/task:** Phase B disposable Neon restore
- **Environment:** Codex in-app browser control
- **Version/commit:** `d7da15d`

## Symptom

The read-only verification of the selected schema-only radio used
`isChecked()`, which is not available on the connected browser surface.

## Impact

Branch creation paused before submission. The disposable branch did not yet
exist, and no identifier or connection detail was printed.

## Reproduction conditions

Call the full Playwright checked-state helper through the restricted connected
browser API.

## Safe evidence

The browser returned only the fixed error that `isChecked` is not a function.

## Attempts and outcomes

- The form selection and branch-name fill completed.
- Verification switches to the supported CSS `:checked` state and compares the
  selected value internally.

## Cause classification

- **Confirmed cause:** The connected browser exposes a restricted Playwright
  API without `isChecked()`.
- **Hypotheses:** None.
- **Rejected hypotheses:** The error does not show that the radio selection
  failed.
- **Known exclusions:** No branch was created and no secret was exposed.

## Correction and prevention

- **Correction:** Verify the unique `input[type=radio]:checked` element through
  CSS state.
- **Prevention:** Use locator state selectors already supported by this browser
  surface instead of full Playwright convenience helpers.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Confirm the schema-only value is the selected radio,
  then submit the authorized create action.

## Verification and related work

The create action remained unsubmitted after the unsupported read.

## Recurrence history

- 2026-07-26T23:19:10Z: First observed and closed.
