# SB-20260727-004357-browser-clipboard-not-system-clipboard: Browser clipboard was not the system clipboard

- **Status:** closed
- **First observed:** 2026-07-27T00:43:57Z
- **Last observed:** 2026-07-27T17:21:56Z
- **Phase/task:** Phase B preview Cloudflare account correction and restore Task 4
- **Environment:** Chrome control, local PowerShell, and GitHub CLI
- **Version/commit:** `22c5dc0`

## Symptom

The Chrome-control clipboard was assumed to be the same clipboard read by
PowerShell. The first GitHub secret update therefore received unrelated local
clipboard content. A later format guard rejected the mismatch before a second
update.

## Impact

The preview Cloudflare account secret is temporarily invalid. The isolated
workflow failed at local configuration validation before any Cloudflare
request, deployment, or scheduled action.

## Reproduction conditions

Write through the controlled browser clipboard and then read through the host
PowerShell clipboard as if both surfaces shared one value.

## Safe evidence

The account-format guard failed, while the in-browser route segment separately
matched the fixed 32-hex account format. Neither value was printed.

## Attempts and outcomes

- The first unguarded clipboard pipeline updated the GitHub secret with the
  wrong local clipboard content.
- The workflow returned only `invalid_configuration`.
- A second update added a strict format guard and stopped before GitHub.

## Cause classification

- **Confirmed cause:** The controlled-browser clipboard and host PowerShell
  clipboard are separate surfaces.
- **Hypotheses:** None.
- **Rejected hypotheses:** The stored in-browser route segment itself was not
  malformed.
- **Known exclusions:** No account identifier, token, or secret value was
  emitted.

## Correction and prevention

- **Correction:** Recover the authenticated Cloudflare account identifier
  directly inside one PowerShell process and pass it to GitHub without
  printing it.
- **Prevention:** Never bridge secret values between browser control and the
  shell through clipboard assumptions; validate before every secret mutation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Parse authenticated Wrangler account output
  internally and require one safe exact target before updating GitHub.

## Verification and related work

The account value was later bridged through the actual host clipboard, guarded
by the exact format contract, and the named GitHub secret showed a recent
update.

## Recurrence history

- 2026-07-27T00:43:57Z: First observed and contained.
- 2026-07-27T00:49:45Z: Closed after replacing the clipboard assumption with a
  validated host-clipboard bridge.
- 2026-07-27T17:21:56Z: Recurred when a provider copy control wrote outside
  the controlled tab clipboard surface. The in-browser read failed strict
  connection-string validation, and no value was printed or transferred. The
  restore workflow must not rely on provider copy controls crossing clipboard
  surfaces.
