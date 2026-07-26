# `src/client/status/FoundationStatus.tsx`

## `FoundationStatus`

**Signature:** `FoundationStatus({ status }): JSX.Element`

Renders the server's deterministic health precedence and only allowlisted operational facts. Every nonhealthy state includes an explicit recovery instruction. Database and R2 warning booleans produce generic messages without metric, identifier, or storage internals.

## `describeFoundationStatus`

**Signature:** `describeFoundationStatus(status): { summary; action? }`

Maps only finite state, authorization state, safe error category, failed-job count, and database/R2 warning booleans to fixed copy. Authorization directs reconnection, capacity warnings direct managed-service review, database failure directs a database-service check, failed jobs direct a later refresh after repair, and unknown cases use a safe refresh/reconnect fallback. It never interpolates raw error or provider text.

## `formatAge`

Converts a validated nonnegative millisecond delay to bounded minute, hour, or day copy; null remains `Not yet`.

## `stateGlyph`

Maps the finite health states to distinct text-adjacent symbols for color-independent comprehension.

## `stateClass`

Converts the finite state label to the corresponding CSS modifier.
