# `src/server/ai/category-context-loader.ts`

This adapter is the trusted disclosure-policy boundary between the encrypted event repository and the category provider. It maps denied, stale, missing, cancelled, cross-owner, and restricted records to no result without revealing which condition occurred.

## `load`

Retrieves and decrypts through an already verified owner-bound repository. It returns `undefined` for records that are not eligible for categorization.

## `createAiCategoryContextLoader`

Creates an `AiCategoryContextLoader` over the narrow `get` portion of `EventRepositoryPort`.

## `buildTrustedCategoryRequest`

Builds the bounded `CategoryProposalRequest` from persisted facts only. It includes the node ID, start, end, time zone, optional title, and server-derived status/busy evidence under policy version `ai-category-v1`; protected free text and contact/location fields remain excluded.
