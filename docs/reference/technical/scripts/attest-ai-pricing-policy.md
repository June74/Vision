# `scripts/attest-ai-pricing-policy.ts`

Performs a value-silent equality attestation between the frozen pricing policy,
one selected source environment, and its flattened deployment artifact. Preview
and production workflows invoke it independently. Missing, stale, malformed,
extra-mode, or wrongly typed bindings fail closed.

## `assertAiPricingDeployArtifact`

Requires the exact five-field policy in `vars`, rejects any same-named secret
binding, and delegates equality to the shared policy assertion.

## `readProvisionedAiPricingPolicy`

Selects one named environment from untrusted JSONC data and returns only the
approved five-field record.

## `extractPolicy`

Requires every approved policy field to be an own string data property.

## `dataValue`

Uses a property descriptor to avoid inherited or accessor-backed input.

## `plainObject`

Admits only non-null, non-array values with `Object.prototype`.

## `readArguments`

Requires the unique artifact path and selected environment flag pair.

## `main`

Reads the fixed source configuration plus the selected artifact, checks the
matching environment in both, and maps every failure to one non-sensitive
message.
