# `src/client/status/FoundationStatus.tsx`

## `FoundationStatus`

Shows whether synchronization is healthy, delayed, needs action, or is disconnected. Every unhealthy state includes a concrete next step based only on safe status facts. It also includes safe sync age, retry count, and storage warnings.

## `describeFoundationStatus`

Chooses a plain-language summary and next step for the current safe health facts.

## `formatAge`

Turns the server's sync delay into a short relative time.

## `stateGlyph`

Adds a visible symbol so operational state does not depend on color.

## `stateClass`

Creates the matching style name for each known state.
