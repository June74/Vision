# SB-20260731-135808-task3-resolver-docs-decoder-unavailable: Resolver docs helper used unavailable V8 decoding

- **Status:** closed
- **First observed:** 2026-07-31T13:58:08.6432924Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
- **Phase/task:** Phase B Task 3 resolver documentation repair
- **Environment:** Main Phase B worktree; V8 orchestration isolate
- **Version/commit:** c5de12d plus owned resolver repair

## Symptom

The safe no-raw-output end-of-file anchor helper called `atob`, which is not
available in the orchestration isolate.

## Impact

The new resolver contract text was not appended. The writer had already removed
misplaced top-of-file additions, so both owned references are structurally
restored but still incomplete.

## Reproduction conditions

Use a browser-style base64 decoder in the isolated orchestration runtime
without first confirming the decoder exists.

## Safe evidence

The writer returned one missing-decoder category. No documentation payload,
source, URI, credential, protected identifier, provider value, argument list,
or environment value was emitted.

## Attempts and outcomes

- Misplaced reference additions were removed successfully.
- Both reference structures are valid again.
- The decoder failure occurred before the intended append.
- Runtime tests and TypeScript remain green from the prior checkpoint.
- No stage, commit, provider action, or external mutation occurred.

## Cause classification

- **Confirmed cause:** The V8 isolate does not expose `atob`.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No filesystem or document-structure failure remains.
- **Known exclusions:** No partial append occurred.

## Correction and prevention

- **Correction:** Use decoder-free exact EOF context with `apply_patch`.
- **Prevention:** Do not assume browser or Node globals exist in the isolated
  orchestration runtime.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The resolver references were updated through exact patch anchors without a
decoder. Documentation coverage then passed with zero violations.

## Recurrence history

- 2026-07-31T13:58:08.6432924Z: First observed and contained before append.
- 2026-07-31T14:05:00.9419278Z: Closed after decoder-free patches completed
  both references and the documentation gate passed.
