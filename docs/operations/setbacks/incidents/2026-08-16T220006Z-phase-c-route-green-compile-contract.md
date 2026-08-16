# SB-20260816-220006-phase-c-route-green-compile-contract

- Incident ID: `SB-20260816-220006-phase-c-route-green-compile-contract`
- First observed: `2026-08-16T22:00:06.175Z`
- Last observed: `2026-08-16T22:02:42.834Z`
- Status: `closed`
- Phase/task: Phase C authenticated one-off write surface Task 6 route GREEN setup
- Environment: isolated Windows Phase C worktree; restricted Worker test pool
- Version/commit: `c53e4ef`

## Symptom

The first TypeScript pass after adding the route module reported that the route
imported `CalendarWriteContractError` from a module that does not export it.
The test TypeScript pass also reported that the fake provider attempted to read
`calendarId` from the provider-event type even though that field is supplied to
the provider input and is not part of the normalized event output.

The Worker suite otherwise reached the expected route-registration boundary:
the new route module loaded, but `createApp` had not yet mounted it, so the
route assertions received the existing API fallback response. No provider,
database, credential, deployment, or source-control state outside this
worktree changed.

## Impact

The route GREEN check was blocked until the import and test fixture type
contracts are corrected and the planned Worker registration is added. No live
mutation or user-facing deployment occurred.

## Evidence

- Source TypeScript diagnostic: `CalendarWriteContractError` was not exported
  by `src/domain/calendar-write/create-execution.ts`.
- Test TypeScript diagnostics: three fake-provider reads referenced an absent
  `CalendarWriteProviderEvent.calendarId` field.
- Worker test result: 15 route assertions received HTTP 404 before registration;
  one registration-export assertion passed.

## Attempts and outcomes

1. Ran source and test TypeScript checks after the first route implementation.
   The diagnostics identified the two exact module/type boundaries above.
2. Ran the focused Worker route suite. It confirmed the route module resolved,
   while the existing Worker registration still correctly used the generic API
   fallback.

## Confirmed cause

The route implementation used the wrong import boundary for the domain error,
and the test fake modeled a provider input field as if it were part of the
provider-neutral event output. Worker registration was a planned next step,
not a runtime/provider failure.

## Hypotheses

- None remain for the recorded compile diagnostics.

## Rejected hypotheses

- Provider or database behavior caused the failures: rejected because the
  injected provider and persistence boundaries were not reached by the 404
  responses.
- The route module was missing: rejected because the test imported it
  successfully.

## Correction and prevention

- Import `CalendarWriteContractError` from the approval domain module.
- Give the fake provider an internal event type that carries calendar scope
  without widening the public provider-event contract.
- Mount the route through the existing Worker `AppDependencies` boundary before
  rerunning the Worker suite.

## Owner and next diagnostic step

- Owner: Vision Phase C implementation.
- Next step: rerun source and test TypeScript checks, then rerun the focused
  Worker suite after registration.

## Related verification

- Repository and domain Phase C checks remained green before this route cycle.
- No provider call, deployment, or live database operation was attempted.

## Closure verification

At 2026-08-16T22:02:42.834Z, the corrected route import and internal stored
event fixture passed both source and test TypeScript checks. The focused Worker
route suite passed 16 assertions, and the broader Phase C schema/domain/
repository/adapter/Worker set passed 49 assertions. The contained Wrangler
filesystem warning is tracked separately.
