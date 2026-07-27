# SB-20260727-193012-neon-connection-modal-dismiss-mismatch: Neon connection modal did not close through an exact Dismiss control

- **Status:** closed
- **First observed:** 2026-07-27T19:30:12Z
- **Last observed:** 2026-07-27T19:30:12Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Neon preview dashboard
- **Version/commit:** `9bbc4be`

## Symptom

After the approved temporary values were transferred to Cloudflare and cleared
from browser-control memory, the Neon connection modal remained open when an
exact `Dismiss` control was attempted.

## Impact

No provider data changed. The modal remained visible longer than intended after
its private connection value was no longer needed.

## Cause classification

- **Working hypothesis:** Neon uses a differently named or icon-only close
  control for this modal.
- **Known exclusions:** The temporary restore values were already saved in
  Cloudflare and cleared from the automation memory before this cleanup attempt.

## Correction and prevention

- **Immediate containment:** Do not inspect or emit modal text.
- **Correction:** Resolve only the modal's safe button labels or icon
  accessibility names, close it, and verify the dialog count reaches zero.
- **Prevention:** Treat each provider modal's close semantics independently
  instead of assuming Cloudflare's control name.

## Verification and related work

The modal exposed no close-labelled button. An Escape keypress closed it, and a
dialog-count check confirmed it was gone without inspecting or emitting its
contents.
