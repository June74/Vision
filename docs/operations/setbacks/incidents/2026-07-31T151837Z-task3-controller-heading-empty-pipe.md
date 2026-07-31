# SB-20260731-151837-task3-controller-heading-empty-pipe: Controller heading summary had an empty pipe element

- **Status:** closed
- **First observed:** 2026-07-31T15:18:37.2748875Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 final controller review repair
- **Environment:** Shared worktree; read-only reference-heading summary
- **Version/commit:** 73191b7 plus unstaged GREEN repairs and setback records

## Symptom

After the controller file reached 53 passing tests, a read-only PowerShell
heading-summary command contained an empty pipe element and failed during
parsing.

## Impact

The six already-known controller reference headings were not added in that
attempt, so the shared documentation gate remains red.

## Reproduction conditions

Compose two bounded heading-summary operations in one PowerShell pipeline with
an empty element between them.

## Safe evidence

Only the parser category was reported. The command did not execute and emitted
no source, heading text, URI, credential, protected identifier, provider value,
runtime stream, argument, environment value, or external action.

## Attempts and outcomes

- Controller tests pass 53/53.
- No reference or other file changed from the failed command.

## Cause classification

- **Confirmed cause:** Invalid PowerShell pipeline syntax.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Controller runtime behavior is not red.
- **Known exclusions:** Resolver, restore, Git, provider, and external state
  were unaffected.

## Correction and prevention

- **Correction:** Use two separate bounded heading queries, then add the six
  already classified headings to the two controller references.
- **Prevention:** Do not combine independent query pipelines into one inline
  expression without syntax validation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete controller references and rerun docs,
  TypeScript, and owned diff verification.

## Verification and related work

Separate bounded queries supported the exact six reference additions, and
documentation plus full repository verification pass.

## Recurrence history

- 2026-07-31T15:18:37.2748875Z: First observed and contained after controller
  GREEN with zero command-side mutation.
- 2026-07-31T15:30:50.5669463Z: Closed after the split query/reference update
  and all canonical gates passed.
