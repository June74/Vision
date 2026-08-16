# SB-20260816-194923-phase-c-adapter-typecheck: provider event tuple widened

- **Status:** closed
- **First observed:** 2026-08-16T19:49:23.3189087Z
- **Last observed:** 2026-08-16T19:49:59.2810361Z
- **Phase/task:** Phase C Google event-write adapter verification
- **Environment:** Windows TypeScript compiler in the isolated Phase C worktree
- **Version/commit:** Uncommitted adapter implementation

## Symptom

The direct source and test TypeScript checks rejected the adapter's normalized
event because an empty array was inferred as a mutable array rather than the
provider contract's exact zero-element tuple.

## Impact

The adapter contract tests passed, but the compile-time boundary was not yet
green. No provider request, deployment, database, credential, or runtime state
was involved.

## Cause classification

- **Confirmed cause:** The returned object used `attendees: []` without the
  explicit `readonly []` contract annotation.
- **Known exclusions:** No runtime behavior or external response was involved.

## Correction and prevention

- **Correction:** Annotated the normalized attendee collection as `[] as
  const` and reran both source and test TypeScript checks.
- **Prevention:** Keep provider-normalization return values explicitly typed at
  closed tuple and null boundaries.

## Verification and related work

The direct source and test TypeScript checks both passed at
2026-08-16T19:49:59.2810361Z.
