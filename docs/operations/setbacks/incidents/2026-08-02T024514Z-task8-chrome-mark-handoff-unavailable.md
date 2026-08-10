# SB-20260802-024514-task8-chrome-mark-handoff-unavailable: Chrome tab handoff method was unavailable

- **Status:** closed
- **First observed:** 2026-08-02T02:45:14.6585311Z
- **Last observed:** 2026-08-02T02:45:49.0694846Z
- **Phase/task:** Phase B Task 8 Vision sign-in handoff
- **Environment:** Existing Chrome browser-control session
- **Version/commit:** Published Task 7 candidate on `codex/phase-b-foundation`

## Symptom

The documented no-argument tab handoff method was not callable on the current
Chrome tab object, so the combined handoff/finalization call stopped before
finalization.

## Impact

The Vision sign-in tab remains open and the user handoff was delayed. No page,
provider, database, calendar, credential, or key state changed.

## Reproduction conditions

Invoke the documented tab handoff convenience method on the current
extension-backed Chrome tab object.

## Safe evidence

The runtime returned only a local method-unavailable category. The subsequent
tab finalization statement did not execute.

## Attempts and outcomes

- The documentation signature was verified in the local API index.
- The current runtime rejected the convenience method before finalization.

## Cause classification

- **Confirmed cause:** The current Chrome tab object does not expose a callable
  handoff convenience method despite the shared API documentation.
- **Hypotheses:** This may be a backend-specific API difference.
- **Rejected hypotheses:** The Vision page and browser connection were not
  reported missing.
- **Known exclusions:** No external state mutation occurred.

## Correction and prevention

- **Correction:** Use the supported browser-level finalizer directly with one
  `{ tab, status: "handoff" }` entry.
- **Prevention:** Treat browser-level finalization as authoritative for this
  Chrome backend and do not require the optional tab convenience method.
- **Owner:** Codex.
- **Next diagnostic step:** Finalize the Vision tab directly and confirm the
  call completes.

## Verification and related work

The browser-level finalizer accepted the Vision tab with handoff status and
completed successfully. No further Chrome action followed.
