# SB-20260728-141900-neon-show-password-blocked-by-browser-policy: Browser policy blocked Neon password reveal

- **Status:** contained
- **First observed:** 2026-07-28T14:19:00Z
- **Last observed:** 2026-07-28T14:19:00Z
- **Phase/task:** Preview database role probe opaque-transfer audit
- **Environment:** Signed-in Neon connection dialog in Chrome
- **Version/commit:** `386b7d3`

## Symptom

The connection dialog exposed one masked application-role URL and one unique
Show-password control. Chrome's security policy rejected the reveal action
before it executed and prohibited retry or alternate browser workarounds.

## Impact

The complete application-role URL could not be transferred opaquely. No click
completed, no value was revealed, and no Neon, Cloudflare, GitHub, database,
R2, deployment, restore, secret, or key state changed.

## Reproduction conditions and safe evidence

- Open the signed-in connection dialog with the expected application role
  selected.
- Bounded inspection finds one masked URL and one reveal control.
- Attempt the unique reveal action through the controlled Chrome surface.
- The policy blocks it before execution.

## Cause classification

- **Confirmed cause:** The browser security policy does not allow the agent to
  reveal the masked database credential.
- **Hypotheses:** A human click on the same control may reveal one complete URL
  for an opaque copy.
- **Rejected hypotheses:** An unmasked URL already exists in element text,
  split text nodes, form values, ARIA attributes, or data attributes; bounded
  projections found none.
- **Known exclusions:** No private value, account label, provider identifier,
  authenticated URL, token, or key was emitted.

## Attempts and outcomes

1. Read-only bounded projections found one masked application-role URL.
2. The reveal action was blocked before execution.
3. No retry, workaround, screenshot, broad DOM capture, or alternate browser
   surface was attempted.

## Correction and prevention

- **Correction:** Require the user to reveal and copy the selected-role URL
  directly, or authorize a separate Neon API credential for a reviewed CI
  handoff.
- **Prevention:** Treat credential-reveal controls as explicit human boundaries
  during planning; do not design agent-only browser acceptance around them.
- **Owner:** Project owner for the human reveal, or Codex after new API
  authority.
- **Next diagnostic step:** Wait for one explicit user choice between the
  manual reveal/copy and temporary Neon API credential paths.

## Verification and related work

`.superpowers/sdd/neon-opaque-transfer-audit-report.md` records fixed safe
counts and confirms zero mutation.
