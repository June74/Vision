# SB-20260726-191656-callback-url-in-test-diff: Callback URL appeared in test failure diff

- **Status:** closed
- **First observed:** 2026-07-26T19:16:56.799087Z
- **Last observed:** 2026-07-26T19:16:56.799087Z
- **Phase/task:** Phase B deployment fix tests
- **Environment:** Local focused unit tests
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

The intentional RED workflow assertion printed a deployment command containing the configured callback address.

## Impact

No secret, authorization code, token, email, or credential was exposed, but a prohibited callback URL appeared in local test output.

## Reproduction conditions

Use a negative string-containment assertion on the full deployment step while
the prohibited flag remains present.

## Safe evidence

The assertion diff rendered the entire deployment step. The output contained
no secret, token, authorization code, email, or credential.

## Attempts and outcomes

- The first intentional RED run printed the full step.
- The assertion was rewritten to compare a Boolean presence result.
- A second intentional RED run failed for the same policy reason without
  rendering the step or callback address.

## Cause classification

- **Confirmed cause:** The assertion library includes the complete received
  string when `not.toContain` fails.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No authentication-bearing URL or private credential was
  involved.

## Correction and prevention

- **Correction:** Asserted on the Boolean result of the containment check.
- **Prevention:** Do not pass whole provider commands or URLs as received values
  to assertions expected to fail.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The repeated RED run proved the same failure without reproducing the URL
output, and the GREEN suite then passed.

## Recurrence history

- 2026-07-26T19:16:56.799087Z: First observed.
