# `src/server/ai-pricing-binding-contract.ts`

Defines a frozen, value-free deployment contract for the five server-only AI
cost inputs. Each declaration includes an exact binding name, the
`secret_text` provider type, and a stable basis identifier. Runtime values
remain in the external deployment environment.

## `AiPricingBindingContractEntry`

Restricts names, type, and basis to the approved literal unions.

## `AI_PRICING_BINDING_CONTRACT`

Provides the frozen binding inventory consumed by normal-state validation.

## `AI_PRICING_CONTRACT_OWNER`

Records the accountable operator role without encoding an individual identity.

## `AI_PRICING_REFRESH_TRIGGERS`

Provides the frozen refresh-event vocabulary used by the operations contract.
