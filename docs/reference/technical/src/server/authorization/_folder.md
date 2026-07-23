# `src/server/authorization`

Server authorization adapters sit between future authentication/session middleware and protected repositories. They
enforce owner equality and deterministic privacy policy, then issue private-symbol-branded decisions. The current task
defines this port and owner-only policy factory; the authentication milestone must supply the verified subject ID.
