# `src/server/ai-pricing-binding-contract.ts`

Defines the frozen deployment contract and exact policy for the five
server-only AI cost inputs. Each declaration includes an exact binding name,
the ordinary-text provider type, a stable basis identifier, and its canonical
source-controlled string.

## `AiPricingBindingContractEntry`

Restricts names, type, and basis to the approved literal unions.

## `AI_PRICING_BINDING_CONTRACT`

Provides the frozen binding inventory consumed by normal-state validation.

## `AI_PRICING_POLICY_VALUES`

Provides the exact five-field policy consumed by runtime schemas, artifact
attestation, and provider-state validation.

## `assertAiPricingPolicyValues`

Requires one plain object with exactly the five approved own string values and
no missing, extra, inherited, accessor-backed, or changed field.

## `AI_PRICING_CONTRACT_OWNER`

Records the accountable operator role without encoding an individual identity.

## `AI_PRICING_REFRESH_TRIGGERS`

Provides the frozen refresh-event vocabulary used by the operations contract.
