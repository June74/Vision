# `src/client/status/CostStatus.tsx`

## `CostStatus`

**Signature:** `CostStatus({ status }): JSX.Element`

Renders the application-ledger monthly cents against the fixed $9.50 hard stop. Its visual meter is decorative; exact amount and availability are text. AI state never hides or disables deterministic calendar features.

## `describeTier`

Maps `normal`, `warning`, `optional_stopped`, and `stopped` to stable copy aligned with the enforced budget policy.

## `formatCents`

Formats the validated integer-cent value with two decimal places.
