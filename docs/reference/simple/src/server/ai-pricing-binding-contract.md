# AI pricing binding contract

Defines the five server-only AI cost settings that an operator provisions
outside source control. The file records only each setting's name, provider
binding type, and pricing basis. It deliberately contains no configured
value.

## `AiPricingBindingContractEntry`

Describes one value-free binding declaration.

## `AI_PRICING_BINDING_CONTRACT`

Lists every required AI pricing and reservation binding exactly once.

## `AI_PRICING_CONTRACT_OWNER`

Names the role responsible for checking the external values.

## `AI_PRICING_REFRESH_TRIGGERS`

Lists the events that require a fresh check before AI acceptance or release.
