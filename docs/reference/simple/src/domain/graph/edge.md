# `src/domain/graph/edge.ts`

This module lists the links Vision understands, such as an event being in a calendar. It rejects unknown link shapes, links across different owners, and links that make data less private.

## `EdgeSchema`

`EdgeSchema` accepts only registered link families and their matching endpoint types.

## `validateEdge`

`validateEdge` checks a link against the two real graph nodes before it is stored.
