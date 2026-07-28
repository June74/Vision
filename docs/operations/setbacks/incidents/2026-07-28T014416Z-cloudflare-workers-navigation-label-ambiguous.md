# SB-20260728-014416-cloudflare-workers-navigation-label-ambiguous: Cloudflare Workers navigation label was ambiguous

- **Status:** closed
- **First observed:** 2026-07-28T01:44:16.5948330Z
- **Last observed:** 2026-07-28T01:44:16.5948330Z
- **Phase/task:** Listener-first restore retry Task 3 Step 2
- **Environment:** Signed-in Cloudflare dashboard
- **Version/commit:** `7d2f9f6`; reviewed candidate `0f08fc1`

## Symptom

The expected Workers navigation label did not resolve to exactly one clickable
link in the current dashboard structure.

## Impact

The guarded count stopped before a click. No secret, Worker, workflow, R2
object, repository, or database state changed.

## Reproduction conditions and safe evidence

Resolve the dashboard navigation item by exact visible label and link role in
the current signed-in account view. The count is not exactly one.

## Attempts and outcomes

- The ambiguous locator was not clicked.
- The existing visible navigation structure was mapped with safe attributes.
- The dashboard remained signed in and unchanged.

## Cause classification

- **Confirmed cause:** The current dashboard exposes an ambiguous or
  differently represented version of the expected label.
- **Hypotheses:** Provider navigation markup may have changed.
- **Rejected hypotheses:** Authentication was available.
- **Known exclusions:** No provider value, account identifier, or private URL
  was returned.

## Correction and prevention

- **Correction:** Use a bounded locator grounded in the current visible
  navigation structure and require exactly one result before interaction.
- **Prevention:** Do not treat provider navigation labels as stable unique
  links; count and scope them every time.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

No external mutation occurred, and the task later reached the signed-in Worker
control surface before stopping on the separate database-role gate.
