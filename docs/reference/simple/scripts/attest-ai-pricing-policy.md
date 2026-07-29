# attest-ai-pricing-policy

Checks that the selected source environment and its generated deployment
artifact carry the complete approved server-only AI pricing policy. Preview
and production invoke it separately. It prints no policy values.

## `assertAiPricingDeployArtifact`

Rejects an artifact unless all five pricing fields exactly match the approved
policy and remain ordinary server variables.

## `readProvisionedAiPricingPolicy`

Reads the five pricing fields from one environment in the source configuration.

## `extractPolicy`

Builds an exact five-field policy record from untrusted variables.

## `dataValue`

Reads an ordinary own property without invoking a getter.

## `plainObject`

Accepts only a normal data object.

## `readArguments`

Accepts the two exact artifact and source-config path pairs.

## `main`

Checks the selected source environment and matching artifact together and emits
only a fixed success or failure message.
