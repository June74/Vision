# `src/client/status/FoundationStatus.tsx`

## `FoundationStatus`

**Signature:** `FoundationStatus({ status }): JSX.Element`

Renders the server's deterministic health precedence and only allowlisted operational facts. Action copy is fixed per state. Database and R2 warning booleans produce generic messages without metric, identifier, or storage internals.

## `formatAge`

Converts a validated nonnegative millisecond delay to bounded minute, hour, or day copy; null remains `Not yet`.

## `stateGlyph`

Maps the finite health states to distinct text-adjacent symbols for color-independent comprehension.

## `stateClass`

Converts the finite state label to the corresponding CSS modifier.
