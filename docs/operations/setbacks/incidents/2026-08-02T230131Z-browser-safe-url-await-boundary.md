# SB-20260802-230131-browser-safe-url-await-boundary: Browser summary placed await inside a synchronous helper

- **Status:** closed
- **First observed:** 2026-08-02T23:01:31.7166432Z
- **Last observed:** 2026-08-02T23:02:04.7562148Z
- **Phase/task:** Phase B OAuth reconnect Task 5 rollback schedule verification
- **Environment:** Read-only Cloudflare dashboard browser inspection
- **Version/commit:** Rolled-back preview at the approved rollback commit

## Symptom

The first privacy-safe dashboard summary used `await` inside a synchronous
URL-classification helper, so JavaScript rejected the summary expression.

## Impact

The browser block did not parse, so no dashboard tab or snapshot was actually
created and no safe page classification was returned. No Cloudflare setting,
deployment, schedule, credential, project file, or protected value changed.

## Reproduction conditions

Call an asynchronous tab URL method from a non-async inline helper.

## Safe evidence

Only the JavaScript async-boundary category was reported. The dashboard URL,
account data, DOM snapshot, and provider identifiers were not rendered.

## Attempts and outcomes

- The invalid block was rejected during parsing before any statement ran.
- A follow-up assumed the earlier tab binding existed and returned only a
  local undefined-binding error; it made no browser or provider action.
- Both incomplete attempts were discarded before dashboard interaction.

## Cause classification

- **Confirmed cause:** `await` was nested inside a synchronous helper.
- **Hypotheses:** None.
- **Rejected hypotheses:** Cloudflare and Vision failures were not evaluated.
- **Known exclusions:** No provider or repository mutation occurred.

## Correction and prevention

- **Correction:** Await the tab URL once at top level, then classify the saved
  string synchronously.
- **Prevention:** Keep all browser awaits at top-level statement boundaries in
  privacy-safe summaries.
- **Owner:** Codex.
- **Next diagnostic step:** Reuse the open tab and emit only safe state
  Booleans.

## Verification and related work

The corrected top-level-await block opened the public dashboard root and
returned only allowlisted host and authentication-state Booleans. Chrome was
then confirmed signed in without rendering any account data.

## Recurrence history

- 2026-08-02T23:02:04.7562148Z: A follow-up referenced the tab binding that
  the parse failure had prevented from being created. The undefined-binding
  result confirmed the original block was atomic at parse time. No browser or
  provider state changed.
