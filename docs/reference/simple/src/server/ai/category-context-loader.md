# `src/server/ai/category-context-loader.ts`

Loads one owner-bound event only after AI budget admission and builds the minimum trusted category packet. Description, attendees, location, meeting links, and caller-supplied evidence never enter the packet.

## `load`

Loads the opaque event reference through the protected event repository.

## `createAiCategoryContextLoader`

Creates the server policy boundary for one owner-scoped protected repository.

## `buildTrustedCategoryRequest`

Copies only the stored event identifier, schedule, time zone, optional title, and a server-derived status fact.
