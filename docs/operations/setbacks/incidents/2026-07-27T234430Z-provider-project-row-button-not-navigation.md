# SB-20260727-234430-provider-project-row-button-not-navigation: Provider project row button was not navigation

- **Status:** closed
- **First observed:** 2026-07-27T23:44:30.613894Z
- **Last observed:** 2026-07-27T23:45:55.6630209Z
- **Phase/task:** Listener-first restore retry Task 2
- **Environment:** Signed-in provider browser session
- **Version/commit:** `4420f6d`

## Symptom

The unique button in the sole project row did not open project context.

## Impact

Provider navigation paused; no provider setting or database state changed.

## Reproduction conditions

Open the signed-in provider project list containing one data row, then activate
the row's sole button.

## Safe evidence

The page contained one project table data row and one button within that row.
Activating the button opened one menu and one dialog without entering project
context. Pressing Escape closed both expanded surfaces.

## Attempts and outcomes

- The row button was activated once after its uniqueness was confirmed.
- The expected project-context navigation did not occur.
- A bounded fixed-shape check proved that the control opened a menu and dialog.
- Escape closed the expanded surfaces before locator rebuilding.

## Cause classification

- **Confirmed cause:** The unique row button was the row action-menu control,
  not project navigation.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** A unique button inside the sole project row is not
  sufficient evidence that the button opens that project.
- **Known exclusions:** No provider setting, branch selection, credential
  access, SQL execution, or database mutation occurred.

## Correction and prevention

- **Correction:** Closed the menu and retained the fresh page state for
  navigation through a semantically verified project-entry surface.
- **Prevention:** Treat per-row buttons as action controls unless current page
  state proves navigation semantics. Verify the destination-bearing row or
  cell separately before interaction.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The expanded-control and open-menu counts returned to zero after Escape. A
fresh page-state check then found exactly one semantic project-entry link in
the row; activating it opened project context successfully.

## Recurrence history

- 2026-07-27T23:44:30.613894Z: First observed.
- 2026-07-27T23:45:55.6630209Z: The control was confirmed as an action-menu
  button, the menu was closed, and the incident was closed without provider or
  database state change.
