# `src/crypto`

This folder is Vision's protected-data boundary. It encrypts private field values before persistence, keeps each user's domains on separate wrapped keys, and allows older key versions to be read after rotation.

The root key is a Worker secret. It is never stored with encrypted records. Active key versions live in an authoritative monotonic store so restarts cannot roll encryption backward.

`test-key-provider.ts` contains no known key, accepts test-generated material only inside Vitest, is forbidden from other production imports, and is checked for absence after every production build.
