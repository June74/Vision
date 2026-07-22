# `src/server`

Server modules coordinate Worker requests and must keep provider and storage credentials out of client bundles. `env.ts` validates deployment bindings, `request-context.ts` establishes opaque request IDs, `errors.ts` owns public-safe response envelopes, and `logging.ts` validates the structured audit allowlist before a sink receives it.
