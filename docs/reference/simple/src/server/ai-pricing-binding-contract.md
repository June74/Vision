# AI pricing binding contract

Defines the five server-only AI cost settings and their exact approved policy.
The settings are ordinary server-side bindings and are never browser bindings.

## `AiPricingBindingContractEntry`

Describes one value-free binding declaration.

## `AI_PRICING_BINDING_CONTRACT`

Lists every required AI pricing and reservation binding exactly once.

## `AI_PRICING_POLICY_VALUES`

Holds the exact source-controlled policy used by both deployment environments.

## `assertAiPricingPolicyValues`

Rejects missing, stale, malformed, extra, or changed policy fields.

## `AI_PRICING_CONTRACT_OWNER`

Names the role responsible for checking the external values.

## `AI_PRICING_REFRESH_TRIGGERS`

Lists the events that require a fresh check before AI acceptance or release.
