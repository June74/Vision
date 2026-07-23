# `src/domain`

This architectural boundary owns provider-independent policies and Zod contracts. Modules remain deterministic and import only other domain modules or validation utilities, so adapters and persistence can consume them without defining product policy.
