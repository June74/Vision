# `src/crypto`

`src/crypto` implements the server-only cryptographic boundary for protected Vision content. Field values use AES-256-GCM with a new 96-bit IV per operation. Authenticated additional data (AAD) binds owner ID, node ID, field name, and data-key version, so ciphertext cannot be moved to another user, graph object, field, or version.

Data keys are random 256-bit values partitioned by owner and domain. They are stored only after AES-GCM wrapping under `KEY_ENCRYPTION_KEY`; the root key remains a non-extractable Worker `CryptoKey`. A store adapter persists only `WrappedDataKeyRecord` values. Rotation advances the active encryption version while exact historical lookups retain decryption access.

Binary values become canonical unpadded base64url only in JSON-shaped envelope records. Envelope parsing is strict and rejects unknown fields, versions, algorithms, noncanonical encodings, and invalid lengths. Tests under `tests/unit/crypto` exercise tampering, AAD separation, key partitioning, malformed boundaries, and rotation.
