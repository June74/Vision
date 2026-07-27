# SB-20260727-004603-powershell-single-candidate-indexed-as-character: PowerShell single candidate was indexed as a character

- **Status:** closed
- **First observed:** 2026-07-27T00:46:03Z
- **Last observed:** 2026-07-27T00:49:45Z
- **Phase/task:** Phase B preview Cloudflare account correction
- **Environment:** Local PowerShell and GitHub environment secrets
- **Version/commit:** `22c5dc0`

## Symptom

PowerShell unrolled one parsed account candidate into a scalar string, so
indexing element zero selected the string's first character instead of the
full candidate.

## Impact

The preview account secret remained invalid, and the isolated workflow stopped
at local configuration validation. GitHub masking of that one character made
ordinary job labels appear partially redacted.

## Reproduction conditions

Pipe one unique string through PowerShell without an explicit array wrapper and
then index `[0]`.

## Safe evidence

The workflow never reached Cloudflare, and its job labels showed repeated
masking consistent with a one-character secret. No character or identifier was
printed by the diagnostic.

## Attempts and outcomes

- The single candidate count check passed because a scalar string reports one
  object.
- Indexing then selected one character.
- The correction wraps pipeline output in `@(...)` and separately validates
  the selected string against the exact 32-hex contract before mutation.

## Cause classification

- **Confirmed cause:** PowerShell scalar unrolling changed the meaning of
  `[0]`.
- **Hypotheses:** None.
- **Rejected hypotheses:** The authenticated Wrangler account candidate itself
  was not missing.
- **Known exclusions:** No provider request, deployment, or scheduled action
  occurred.

## Correction and prevention

- **Correction:** Force candidate output into an array, extract one string, and
  validate its complete shape before updating GitHub.
- **Prevention:** Never rely on PowerShell collection indexing after a pipeline
  without `@(...)` and a post-extraction shape assertion.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Correct the secret with the guarded full candidate
  and retry the isolated workflow.

## Verification and related work

The later correction validated the full 32-character account shape before
updating GitHub; the one-character masking disappeared.

## Recurrence history

- 2026-07-27T00:46:03Z: First observed and contained.
- 2026-07-27T00:49:45Z: Closed after explicit array handling and full-value
  validation replaced scalar indexing.
