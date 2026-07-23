# Authentication domain rules

This folder owns provider-neutral allowlist decisions after an OAuth boundary has already verified an identity token. It has no network, persistence, session, browser, or token-signature dependency; integrations must pass only server-verified claims into these rules.
