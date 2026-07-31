# run-preview-acceptance-controller

Runs the guarded observer, candidate, rollback, closure, and uniqueness
sequence. It snapshots untrusted input before remote work and reports only
fixed status words.

## `createPreviewControllerSubprocessDependencies`

Creates the real process boundary. Git and the controller driver receive
argument arrays, child output is captured, and each driver reply must have one
small exact JSON shape.

## `invoke`

Runs one captured child command and converts every failure to the controller's
single safe error.

## `invokeDriver`

Serializes one bounded input object and invokes one fixed driver operation.

## `expectOk`

Accepts only the exact driver acknowledgement.

## `assertRemoteTip`

Confirms the reviewed branch still points to the reviewed commit immediately
before every dispatch.

## `dispatch`

Serializes dispatch through the canonical closed context and accepts only one
positive run reference.

## `resolveObserver`

Asks the driver to resolve the already-dispatched observer without exposing
its handle.

## `readObserverState`

Reads one closed observer state and optional signal timestamp.

## `verifyCandidateAttribution`

Requires the candidate run to be attributed before an action can continue.

## `admitRestore`

Rechecks the immediately preceding same-commit role-probe closure through the
private driver and returns the controller-created restore attestation.

## `requestApproval`

Requests approval for user-mediated families and accepts only one canonical
approval time.

## `performAction`

Performs the exact admitted action and accepts only one canonical completion
time.

## `verifyClosure`

Asks the driver to verify the rollback closure artifact.

## `writeStatus`

Writes only a member of the fixed status vocabulary.

## `runPreviewAcceptanceController`

Keeps the observer handle private, starts observation before mutation, verifies
attribution and timing, rolls back and closes once, then waits for any required
uniqueness proof. An uncertain rollback is never retried.

## `rollbackAndClose`

Latches the rollback attempt before dispatch, rechecks both signal deadlines,
dispatches rollback, and verifies closure.

## `waitForSignal`

Polls the active observer every five seconds until success or a bounded
failure. The absolute limit is the earlier of action completion plus two
minutes or candidate expiry minus one minute, even when the action driver
returns late. A driver completion or provider signal timestamp later than its
paired wall sample fails before deadline calculation or rollback; the
candidate is still cleaned up.

## `assertPreActionIdleDeadline`

Requires enough candidate lifetime for the fixed three-minute pre-action idle
boundary.

## `assertRollbackDispatchDeadline`

Requires rollback dispatch to start within 50 seconds of local detection and
59 seconds of the provider listener timestamp.

## `waitForMaintenanceUniqueness`

Waits only for the permanent maintenance observer; it never dispatches a
temporary maintenance candidate. Success cannot settle before the exact
tick-plus-two-minute close. Paired wall and monotonic clocks bound continued
provider polling through the inclusive close-plus-two-minute settlement
deadline.

## `createObserveContext`

Builds the exact observe context. Maintenance carries only its scheduled tick;
the controller and printer derive the fixed close internally. Other families
start uniqueness at their admitted terminal.

## `createCandidateContext`

Builds the exact candidate context with lifecycle and observer-dispatch
bindings.

## `candidateOperation`

Maps each non-maintenance family to its one admitted deployment operation.

## `isTwoJobFamily`

Recognizes restore and synchronization suppression, whose signal and
uniqueness jobs remain separate.

## `isUserMediatedFamily`

Separates families that need explicit approval/action from scheduled candidate
confirmation.

## `validCommit`

Accepts one lowercase reviewed commit.

## `validRunRef`

Accepts one positive decimal provider run reference.

## `canonicalDate`

Accepts one canonical millisecond UTC timestamp.

## `safeNow`

Copies one valid wall-clock `Date`.

## `safeMonotonic`

Accepts one finite monotonic timestamp.

## `createInProcessObserverPort`

Keeps provider run identifiers inside an opaque resolver/state port.

## `snapshotObserverResolutionInput`

Copies the exact controller-to-resolver request without serializing the
observer handle.

## `snapshotControllerObserverState`

Copies one custom observer result into the controller's closed state.

## `snapshotControllerInput`

Validates and freezes one exact family-compatible controller input before any
remote action.

## `snapshotExpectation`

Rebuilds the only expectation allowed for the selected family.

## `maintenanceObserverClosesAt`

Derives the maintenance close as its scheduled tick plus two minutes.

## `serializePreviewApprovalInput`

Builds one exact bounded approval payload.

## `serializePreviewActionInput`

Builds one exact bounded action payload.

## `serializePreviewClosureInput`

Builds one exact bounded closure-verification payload.

## `validateActionInput`

Checks the common action fields before serialization.

## `runCapturedCommand`

Runs a child with captured bounded streams and never forwards them.

## `parseDriverJsonLine`

Parses exactly one JSON line from the driver.

## `serializeDriverInput`

Serializes one bounded ordinary input value for a single driver argument.

## `snapshotDriverValue`

Recursively copies bounded own data without invoking accessors.

## `readDriverDate`

Reads one exact driver timestamp record.

## `boundedCommandPart`

Checks one executable or command-prefix element.

## `boundedDriverArgument`

Checks one driver argument without shell interpretation.

## `boundedRepository`

Checks the repository form accepted by the in-process observer adapter.

## `exactRecord`

Requires an ordinary object with exactly the declared own data keys.

## `exactRecordWithOptional`

Requires exact mandatory keys and only declared optional keys.

## `ownData`

Reads one required own data property without invoking it.

## `optionalOwnData`

Reads one optional own data property without invoking it.

## `isControllerFamily`

Recognizes the closed family vocabulary.

## `isObserverState`

Recognizes `listening`, `succeeded`, or `failed`.

## `isControllerStatus`

Recognizes the status-only output vocabulary.

## `validLifecycleRunRef`

Accepts the baseline marker or one positive decimal lifecycle reference.

## `parseControllerArguments`

Accepts only the bounded controller input-file and driver command arguments.

## `main`

Runs the concrete controller, prints only fixed statuses, keeps stderr empty,
and emits one `failed_closed` status on any failure.

## `fail`

Throws the sole value-free controller error.
