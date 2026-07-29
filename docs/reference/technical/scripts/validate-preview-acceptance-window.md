# `scripts/validate-preview-acceptance-window.ts`

Implements the fail-closed lifetime guard used before candidate preparation
and immediately before preview deployment. Pure time rules live in the
temporary acceptance domain module. The second mode reads the exact generated
candidate expiry instead of recalculating it from the current clock.

## `plainObject`

Admits only non-null, non-array values with `Object.prototype`.

## `dataValue`

Uses a property descriptor to read only an enumerable own data value.

## `main`

No-argument mode validates the complete maximum interval beginning now.
`--candidate dist/vision/wrangler.acceptance.json` validates the canonical
deadline embedded in the fixed artifact. Every other argument or input maps to
one non-sensitive error and nonzero exit status.
