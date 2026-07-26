# SB-20260726-224457-safe-tail-treated-pretty-json-as-lines: Safe tail treated pretty JSON as lines

- **Status:** closed
- **First observed:** 2026-07-26T22:44:57Z
- **Last observed:** 2026-07-26T22:44:57Z
- **Phase/task:** Phase B privacy-safe live diagnostics
- **Environment:** GitHub Actions with Wrangler 4.113
- **Version/commit:** `1862323`

## Symptom

The safe-tail workflow reported `no_scheduled_event` after remaining connected
for its full window.

## Impact

The result could not distinguish no invocation from a parser that rejected
Wrangler output. Raw provider output remained suppressed.

## Reproduction conditions

Parse each stdout line independently while Wrangler's JSON logger serializes
each event with four-space indentation across multiple lines.

## Safe evidence

The installed Wrangler implementation calls
`JSON.stringify(data, null, 4)`. A failing unit test reproduced the multiline
case, and the accumulator fix passed that test without copying raw fields.

## Attempts and outcomes

- The first filter ignored every partial JSON line.
- A RED test failed because no multiline accumulator existed.
- The minimal accumulator buffers at most one MiB, parses only complete JSON,
  resets after each complete event, and returns only the existing allowlist.
- All nine safe-tail and workflow policy tests passed after the fix.

## Cause classification

- **Confirmed cause:** The filter assumed newline-delimited compact JSON, while
  this Wrangler version emits pretty-printed JSON.
- **Rejected hypotheses:** The first safe-tail result does not prove that no
  cron invocation occurred.
- **Known exclusions:** Raw Cloudflare events, URLs, IDs, messages, secrets,
  and protected content were not emitted.

## Correction and prevention

- **Correction:** Incrementally assemble one complete JSON object before
  classification.
- **Prevention:** Contract-test operational parsers against the installed
  tool's actual serialization shape.
- **Owner:** Codex.

## Verification and related work

The multiline privacy test and existing single-line tests pass, and TypeScript
checks remain green.

## Recurrence history

- 2026-07-26T22:44:57Z: First occurrence.
