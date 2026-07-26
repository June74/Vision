# `src/client/calendar/CategoryControl.tsx`

## `CategoryControl`

**Signature:** `CategoryControl({ event, onChange }): JSX.Element`

Renders a labeled native select with a 44-pixel target, visible provenance, a Vision-only boundary statement, and saving/success/error announcements. During a request, the select remains focused and keyboard-reachable while `aria-disabled` and `aria-busy` communicate its guarded state. It does not optimistically change the authoritative event.

## `selectCategory`

Validates the finite select value, synchronously locks duplicate submission through a ref, restores the displayed authoritative value for duplicate change events, awaits server confirmation, and leaves the prior event state intact on failure. The native control is not disabled, so focus survives both success and error.

## `formatCategoryMark`

Maps unresolved, inferred, user-confirmed, and other confirmed provenance to explicit text. The state remains understandable without its CSS color.
