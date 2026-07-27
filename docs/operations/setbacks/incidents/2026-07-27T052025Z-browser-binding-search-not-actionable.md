# SB-20260727-052025-browser-binding-search-not-actionable: Browser binding search was not actionable

- **Status:** closed
- **First observed:** 2026-07-27T05:20:25Z
- **Last observed:** 2026-07-27T17:57:10Z
- **Phase/task:** Phase B restore Task 4
- **Environment:** Signed-in preview provider dashboard
- **Version/commit:** `80e8c3e` with reviewed candidate `41b05fd`

## Symptom

A binding-type search field existed in the document structure, but the
browser-control fill operation timed out before entering text.

## Impact

No value was entered, no form was submitted, and no provider, repository,
credential, or runtime state changed. The restore sequence paused.

## Reproduction conditions

Open the add-binding chooser and target its document-level search field
without first proving that the matched field is the visible field in the
active dialog.

## Safe evidence

The control count was one, but the fill action reached its interaction
deadline. No provider-controlled string or field value is retained here.

## Attempts and outcomes

- The document-level selector found one search-shaped field.
- The fill operation did not act on it and timed out.
- No retry has been attempted while this incident is contained.

## Cause classification

- **Confirmed cause:** The selected document-level field was not actionable.
- **Hypothesis:** The page retained an inactive dialog field while a different
  visible dialog layer owned interaction.
- **Rejected hypotheses:** No network or credential failure was reported.
- **Known exclusions:** No secret, database value, token, key, account
  identifier, provider URL, or protected row was emitted.

## Correction and prevention

- **Correction:** Refresh the in-memory page model and scope to the active
  visible dialog before locating the field or a direct binding-type choice.
- **Prevention:** Prove active-dialog uniqueness and visible state before every
  provider form interaction.
- **Owner:** Codex.
- **Next diagnostic step:** Inspect only fixed counts for visible dialogs and
  visible search controls, then select one unique active control.

## Verification and related work

Closed after both temporary secrets were configured through uniquely scoped
visible-dialog controls, later removed through uniquely scoped row/dialog
controls, and verified absent by name only.

## Recurrence history

- 2026-07-27T05:20:25Z: First observed and contained.
- 2026-07-27T17:13:16Z: Recurred when a form type label was visible but the
  document-level role locator was not unique. The check failed closed before
  clicking, filling, or submitting. The retry must scope the control to the
  one visible dialog.
- 2026-07-27T17:20:58Z: Recurred when the only visible read-only field in a
  provider connection panel was assumed to contain the connection string. A
  strict scheme and whitespace check rejected it before transfer; the value
  was not printed or sent. The retry must use the unique provider copy control
  and validate the clipboard payload without returning it.
- 2026-07-27T17:26:11Z: Recurred when the second variable type selector did
  not expose an option with the expected role after opening. The form remained
  unsubmitted and both values stayed in browser memory. The retry must inspect
  only fixed selector-state counts and rebuild from the fresh dialog model.
- 2026-07-27T17:57:10Z: Closed after fresh-dialog scoping configured both
  temporary secrets, then fresh-row scoping removed them and verified both
  names absent without returning either value.
