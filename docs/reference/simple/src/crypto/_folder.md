# `src/crypto`

This folder is Vision's protected-data boundary. It encrypts private field values before persistence, keeps each user's domains on separate wrapped keys, and allows older key versions to be read after rotation.

The root key is a Worker secret. It is never stored with encrypted records. The `test-key-provider.ts` module has an explicit test-only guard and is not selected from `RuntimeEnv`.
