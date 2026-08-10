# SB-20260802-045519-task8-cloudflare-settings-control-role: Cloudflare Worker settings control was not a link

- **Status:** closed
- **First observed:** 2026-08-02T04:55:19.951324Z
- **Last observed:** 2026-08-02T04:57:26.9015134Z
- **Phase/task:** Phase B Task 8 owner-allowlist deployment verification
- **Environment:** Signed-in Cloudflare preview dashboard
- **Version/commit:** Published Task 7 candidate `e283410`

## Symptom

The role-specific Worker settings click exceeded its bound because the visible control was not exposed as a link.

## Impact

The read-only deployment check paused; no Worker setting, secret, deployment, key, or provider state changed.

## Reproduction conditions

Open the preview Worker's configuration and attempt to resolve the visible
Settings control as a link.

## Safe evidence

The link role did not resolve within the bounded wait. A role-only count found
two exact-text matches, zero buttons, and one tab. The tab opened the settings
view; the variables section and the `GOOGLE_ALLOWED_EMAIL` name were present.
No private value was read or emitted.

## Attempts and outcomes

- Resolving Settings as a link timed out without changing provider state.
- Counting only role shapes established that the unique interactive control
  was a tab.
- Resolving Settings as an exact-name tab succeeded.

## Cause classification

- **Confirmed cause:** The Cloudflare dashboard exposes the Worker's Settings
  control as a tab, not a link.
- **Hypotheses:** The browser session or provider page had failed to load.
- **Rejected hypotheses:** The signed-in dashboard and Worker configuration
  were available once the correct control role was used.
- **Known exclusions:** No setting, secret, deployment, key, or other provider
  state was mutated during diagnosis.

## Correction and prevention

- **Correction:** Resolve the unique exact-name Settings tab.
- **Prevention:** When dashboard text is ambiguous, count bounded accessible
  roles before interacting and emit only fixed counts or booleans.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this control-role mismatch.

## Verification and related work

The settings page and variables section were present, and the approved email
allowlist variable name was visible without reading its secret value. The
read-only verification completed with no external mutation.

## Recurrence history

- 2026-08-02T04:55:19.951324Z: First observed.
- 2026-08-02T04:57:26.9015134Z: Corrected with the exact-name tab role and
  closed after read-only verification.
