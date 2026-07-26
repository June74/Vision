# `src/client/calendar/CategoryControl.tsx`

## `CategoryControl`

**Signature:** `CategoryControl({ event, onChange }): JSX.Element`

Renders a labeled native select with a 44-pixel target, visible provenance, a Vision-only boundary statement, and polite success or alert failure announcements. It does not optimistically change the authoritative event.

## `selectCategory`

Validates the finite select value, disables duplicate submission while pending, awaits server confirmation, and leaves the prior event state intact on failure.

## `formatCategoryMark`

Maps unresolved, inferred, user-confirmed, and other confirmed provenance to explicit text. The state remains understandable without its CSS color.
