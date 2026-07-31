# validate-preview-observer-state

Checks that a preview acceptance observer is still waiting in the exact
allowlisted evidence-printing step before a candidate can deploy.

## `PreviewObserverEvidence`

Lists the admitted privacy-safe evidence families.

## `PreviewObserverState`

Groups the expected commit, evidence family, run response, and jobs response.

## `validatePreviewObserverState`

Requires the matching workflow run and exact family topology to be active.
AI, suppression, and restore each require independent signal and uniqueness
jobs; maintenance requires uniqueness only.

## `activeExactListener`

Requires one independently active job and its one exact listener step.

## `isCanonicalInstant`

Recognizes one canonical millisecond UTC maintenance tick.

## `plainObject`

Accepts only ordinary data objects.

## `readResponse`

Reads one bounded response file for local validation.

## `parseArguments`

Accepts each required command flag exactly once.

## `main`

Reads the two captured responses and prints only a fixed safe outcome.
