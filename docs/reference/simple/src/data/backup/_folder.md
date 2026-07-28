# `src/data/backup`

Turns a consistent raw database snapshot into an encrypted portable backup, connects it to private R2 and Neon
adapters, and restores it through a disposable transactional preview target. The temporary retry adds an opaque R2
one-shot claim and a serializable, attestation-locked clear that is removed after live acceptance.
