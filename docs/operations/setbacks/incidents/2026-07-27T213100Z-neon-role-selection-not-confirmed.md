# SB-20260727-213100-neon-role-selection-not-confirmed: Neon role selection was not confirmed

- **Status:** closed
- **First observed:** 2026-07-27T21:31:00.7824693Z
- **Last observed:** 2026-07-27T21:58:42.4268852Z
- **Phase/task:** Listener-first restore retry Task 2 execution
- **Environment:** Signed-in Neon SQL Editor connection modal
- **Version/commit:** `ca11c6c`

## Symptom

The unique restricted-role option was activated, but the original fixed-shape
follow-up probe falsely reported that the labeled selector had not adopted it.

## Impact

SQL execution stopped before the editor was changed. No database row, provider
resource, secret, deployment, or branch state changed.

## Reproduction conditions

Open the connection modal, activate the unique restricted-role option, and
check the previously resolved labeled input value immediately afterward.

## Safe evidence

The option count was exactly one, the popup closed after activation, and the
first labeled-input equality check returned false. No selector value,
connection information, target identity, or provider URL was returned.

## Attempts and outcomes

- The role popup exposed one exact restricted-role option.
- Activating it closed the popup.
- The first labeled-input equality check was inconclusive, so execution
  stopped before any SQL action.
- A second attempt first filtered the selector to the exact restricted role,
  then activated the only matching option. The popup closed, but the fresh
  selected-value check still did not prove the restricted role.

## Cause classification

- **Confirmed cause:** The labeled element is the role selector's empty search
  input, not its selected-value surface. The original checks read that input,
  restricted control inspection to buttons and inputs, and used a
  whitespace-boundary match against concatenated dialog text. The selected
  role is rendered through visible nested text nodes, while the open menu marks
  its exact option with `aria-selected=true`.
- **Hypotheses:** None open.
- **Rejected hypotheses:** The provider did not fail to commit the role. The
  exact option was already selected, activation closed the menu, the visible
  selected label appeared, and the role persisted after the connection modal
  was closed and reopened. Opening the database selector did not reset the
  role; the Escape key closed the enclosing connection modal.
- **Known exclusions:** No SQL, branch mutation, secret action, deployment, or
  private-value output occurred.

## Correction and prevention

- **Correction:** Verify both the exact option's selected accessibility state
  while the menu is open and the exact visible selected-role label after the
  menu closes. The bounded reproduction passed both checks.
- **Prevention:** Do not use the labeled search input value or concatenated
  dialog text as selected-role evidence. Require a unique exact option with
  `aria-selected=true`, a visible exact selected-role node after closure, and
  persistence across one connection-context reopen before any future SQL.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** In a separately authorized provider-operation
  task, rerun the corrected fixed-shape role proof before staging the reviewed
  SQL.

## Verification and related work

One bounded read-only reproduction confirmed:

- the disposable branch remained selected and the normal preview primary
  branch did not;
- two role options were visible and exactly one matched the approved
  restricted role;
- that exact option reported `aria-selected=true`;
- option activation closed the menu;
- three visible exact selected-role nodes were present while the role search
  input remained empty;
- closing and reopening the connection modal preserved the selected role; and
- no SQL, connection value, provider identifier, secret, database row, or
  branch mutation occurred.

The modal was closed and the provider tab was finalized.

## Recurrence history

- 2026-07-27T21:31:00.7824693Z: First observed and contained before SQL.
- 2026-07-27T21:32:49.6944001Z: The exact-filter retry also failed to prove the
  restricted role. The task stopped blocked, closed the modal, and finalized
  the provider tab without SQL.
- 2026-07-27T21:42:30.9364223Z: A bounded read-only reproduction proved that
  the role was selected and persisted. The earlier blocker was a
  false-negative verifier aimed at the selector's empty search input instead
  of its visible selected-value surface. The incident closed without SQL or
  provider mutation.
- 2026-07-27T21:58:42.4268852Z: The resumed execution used the corrected gate
  before SQL. Exactly one `vision_app` option reported
  `aria-selected=true`; activation closed the menu and three visible exact
  selected-value nodes confirmed the role. No selector was opened afterward.
  The incident remains closed.
