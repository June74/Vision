# SB-20260728-032045-cloudflare-screenshot-account-label-exposure: Dashboard screenshot included an account label

- **Status:** closed
- **First observed:** 2026-07-28T03:20:45Z
- **Last observed:** 2026-07-28T13:52:55Z
- **Phase/task:** Preview database role probe Task 2 live resume
- **Environment:** Signed-in Cloudflare browser controls
- **Version/commit:** `979228b`

## Symptom

A diagnostic screenshot of the Worker settings page included the signed-in
account label in the dashboard chrome.

## Impact

The private account label appeared in internal tool output. It was not copied
into repository files, commentary, final output, logs, or external messages.
No credential value, database URL, token, authorization code, or encryption key
was exposed.

## Reproduction conditions and safe evidence

- Capture a full viewport of the signed-in Worker settings page.
- The dashboard header includes the signed-in account label outside the target
  Variables and Secrets section.

## Cause classification

- **Confirmed cause:** The diagnostic capture was not cropped or text-filtered
  to the target section before being emitted.
- **Hypotheses:** None.
- **Rejected hypotheses:** The private label did not originate from a Worker
  variable or secret value; it came from the surrounding dashboard chrome.
- **Known exclusions:** No secret value, database URL, token, authorization
  code, provider key, or encryption key appeared.

## Attempts and outcomes

1. One full-viewport diagnostic capture was emitted internally.
2. The exposure was contained by discontinuing screenshots for this diagnosis.

## Correction and prevention

- **Correction:** Continue with bounded DOM projections that redact identifiers
  and return only safe booleans, counts, labels, and categories.
- **Prevention:** Never emit an uncropped signed-in provider screenshot. Prefer
  text-only projections; if visual evidence is essential, crop to the exact
  target region and inspect for account chrome first.
- **Owner:** Codex.
- **Next diagnostic step:** Continue the secret-persistence investigation with
  redacted text-only evidence.

## Verification and related work

Repository search and the safe live report contain no copy of the private
account label, and subsequent provider inspection uses bounded redacted text.

## Recurrence history

- 2026-07-28T13:52:55Z: A resumed live worker emitted a broad provider DOM
  snapshot containing private/provider-identifying page chrome into internal
  tool output before any mutation. The output was not copied into tracked
  files, user-facing text, or external messages. Broad captures were stopped;
  the worker was restricted to bounded redacted projections and safe
  booleans/counts.
