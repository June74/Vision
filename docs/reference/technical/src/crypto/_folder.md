# `src/crypto`

`src/crypto` implements the server-only cryptographic boundary for protected Vision content. Field values use
AES-256-GCM with a new 96-bit IV per operation. Authenticated additional data (AAD) binds owner ID, node ID, domain,
field name, and data-key version, so ciphertext cannot be moved to another user, graph object, domain, field, or
version.

Data keys are random 256-bit values partitioned by owner and domain. They are stored only after AES-GCM wrapping under `KEY_ENCRYPTION_KEY`; the root key remains non-extractable. The store persists wrapped records and an atomic monotonic active-version high-water mark. Each active lookup snapshots the store version once; rotation raises it asynchronously, restart rollback is rejected, and historical lookup stays exact.

Binary values become canonical unpadded base64url only at boundaries. A field is limited to 64 KiB of UTF-8 plaintext; encoded IV, ciphertext, wrapped-key, and serialized JSON limits are checked before decoding/parsing. The Vitest provider has no embedded key and is excluded by source and post-build bundle contracts.
