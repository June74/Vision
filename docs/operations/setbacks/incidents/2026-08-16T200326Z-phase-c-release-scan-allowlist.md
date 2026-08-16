# SB-20260816-200326-phase-c-release-scan-allowlist: Phase C adapter not allowlisted

- **Status:** closed
- **First observed:** 2026-08-16T20:03:26.7552327Z
- **Last observed:** 2026-08-16T20:03:26.7552327Z
- **Phase/task:** Phase C one-off create release-boundary verification
- **Environment:** Windows isolated Phase C worktree
- **Version/commit:** Adapter present after `2110509`; scanner correction uncommitted at detection

## Symptom

The release security scan rejected
`src/integrations/google-calendar/event-write-client.ts` with the
`google-event-write` category even though the adapter was intentionally added
as the bounded Phase C provider surface.

## Impact

Release verification stopped before any publication, deployment, or provider
request. The scan correctly prevented an unreviewed Google write surface from
passing the gate; no external or private state changed.

## Cause classification

- **Confirmed cause:** The scanner's Google operation map contained only the
  earlier OAuth, calendar-setup, and read-sync surfaces. It had no exact
  Phase C event-write entry, and its transport-forwarder rule did not recognize
  the adapter's bounded `requestJson` helper.
- **Known exclusions:** The adapter did not call a Google SDK or expose an HTTP
  route; its contract tests were already green.

## Correction and prevention

- **Correction:** Added exact GET/POST/DELETE operation patterns for the fixed
  Calendar API calendar/events paths, plus a file- and function-scoped rule
  for the reviewed transport forwarder and request-builder callsites. Added a
  regression test for the approved adapter surface.
- **Prevention:** Every new provider-facing Phase C adapter must add an exact
  scanner allowlist entry and a clean-fixture regression test before release
  evidence is captured.

## Verification and related work

The bounded scanner regression passed and the actual release scan passed at
2026-08-16T20:03:16Z. No deployment or live provider command was run.
