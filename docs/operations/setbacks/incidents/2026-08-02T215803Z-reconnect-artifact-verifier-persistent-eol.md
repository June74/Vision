# SB-20260802-215803-reconnect-artifact-verifier-persistent-eol: Artifact verifier required persistent EOL configuration

- **Status:** closed
- **First observed:** 2026-08-02T21:58:03.884135Z
- **Last observed:** 2026-08-02T22:00:31.9006270Z
- **Phase/task:** Phase B OAuth reconnect Task 5 artifact verification
- **Environment:** Local Windows PowerShell, short detached Git worktrees
- **Version/commit:** candidate `c1911f8`; rollback `94b8810`

## Symptom

The independent verifier stopped after treating an absent persistent core.eol value as a Git failure.

## Impact

The first independent artifact verdict was discarded; no artifact, source, Git metadata, provider, or external state changed.

## Reproduction conditions

Run the first independent verifier against either short artifact after the
guarded checkout applies LF settings only to the `git worktree add` command.

## Safe evidence

Labeled read-only Git checks returned zero for HEAD, branch, tracked status,
and raw byte hashing on both artifacts; only the persistent `core.eol` lookup
returned one. No private value or provider output was read.

## Attempts and outcomes

- The original generic wrapper discarded the incomplete verdict.
- Per-command diagnosis isolated the nonzero result to the persistent
  `core.eol` lookup in both artifacts.

## Cause classification

- **Confirmed cause:** The verifier incorrectly treated command-scoped LF
  checkout settings as persistent worktree configuration requirements.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The global-ignore warning did not cause the generic
  wrapper failure; tracked status exited zero on both artifacts.
- **Known exclusions:** Artifact creation, commit identity, tracked state,
  provider state, credentials, keys, and deployment were not changed.

## Correction and prevention

- **Correction:** Verify the actual contract: exact detached commit, clean
  tracked state, registration, containment, and raw working-byte parity with
  the committed blobs.
- **Prevention:** Do not assert persistence for Git settings intentionally
  scoped to the checkout command; verify their resulting bytes directly.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The explicit-command verifier returned true for exact commit, detached state,
tracked cleanliness, containment, registration, and raw working-byte parity
across all four byte-sensitive files in both artifacts.

## Recurrence history

- 2026-08-02T21:58:03.884135Z: First observed.
- 2026-08-02T21:58:18.6675488Z: Contained after labeled diagnosis isolated
  the incorrect persistent-configuration assertion.
- 2026-08-02T22:00:31.9006270Z: Closed after the corrected verifier checked
  the resulting bytes and all other immutable-artifact invariants directly.
