# `src/domain/calendar-write`

This folder owns the provider-neutral Phase C write contract. It validates
immutable proposals, produces exact before/after previews, and enforces the
approval transition graph. It contains no Worker, provider, database, crypto,
or browser boundary; later integrations must consume these values rather than
reimplement their policy.
