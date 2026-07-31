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
positive run reference. If a candidate or rollback receipt is uncertain,
reconciliation uses a fresh bounded window and the exact frozen
operation/context/commit tuple. A timed-out candidate is sent directly through
rollback. An uncertain rollback is never retried; an exactly reconciled one is
attributed, settled, closed, and then reported failed closed.

## `resolveObserver`

Asks the driver to resolve the already-dispatched observer without exposing
its handle.

## `readObserverState`

Reads one closed observer state and optional signal timestamp.

## `verifyCandidateAttribution`

Requires the candidate run to be attributed before an action can continue.

## `awaitRollbackSettlement`

Waits for the exact rollback run to finish before closure can be dispatched.

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
uniqueness proof. A timed-out accepted candidate is reconciled once and rolled
back without action. An uncertain rollback is never retried. A later successful
provider completion may move a two-job uniqueness close forward, never
backward. The controller rejects implausibly future advancement, extends its
deadline only to the new semantic close, and keeps one fixed workflow-aware
verification ceiling. Maintenance is rejected before observer dispatch when
its tick-plus-two-minute semantic close would outlive the 46-minute listener.
For AI evidence, it creates one 30-minute window before observer dispatch and
reuses the same scheduled instant and expiry in both canonical contexts.

## `rollbackAndClose`

Latches the rollback attempt before dispatch, rechecks both signal deadlines,
and dispatches rollback within that strict deadline. Rollback settlement,
closure dispatch, and closure verification then each receive a fresh bounded
deadline appropriate to that stage.

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

Builds the exact observe context. AI success carries only its scheduled instant
and expiry. Maintenance carries only its scheduled tick;
the controller and printer derive the fixed close internally. Other families
start uniqueness at their admitted terminal.

## `createCandidateContext`

Builds the exact candidate context with lifecycle and observer-dispatch
bindings. Only `deploy_ai` adds the verified zero-active gate and exact window.

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

Keeps provider run identifiers inside an opaque resolver/state port. The
controller's deadline and abort signal are forwarded to resolution and every
state reader, and the two-job reader's stable uniqueness close is preserved.

## `snapshotObserverResolutionInput`

Copies the exact controller-to-resolver request without serializing the
observer handle.

## `snapshotControllerObserverState`

Copies one custom observer result into the controller's closed state. A missing
or null uniqueness close remains missing provider evidence; the controller does
not replace it with a local timestamp.

## `snapshotControllerInput`

Validates and freezes one exact family-compatible controller input before any
remote action.

## `snapshotExpectation`

Rebuilds the only expectation allowed for the selected family.

## `maintenanceObserverClosesAt`

Derives the maintenance close as its scheduled tick plus two minutes.

## `assertMaintenanceObserverFitsListenerEnvelope`

Requires the maintenance close to fall between observer startup and the exact
inclusive 46-minute listener boundary. Invalid evidence is rejected before
the observer is dispatched or awaited.

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

## `reconcileCandidateDispatch`

Checks whether a candidate dispatch actually succeeded when its caller did not
receive a trustworthy receipt, without dispatching it again.

## `runControllerCall`

Runs one dependency call inside a bounded deadline that can be aborted. The
caller selects the maximum duration for the workflow stage.

## `nextPreSignalDeadline`

Chooses the tighter ordinary pre-signal call deadline before a signal is proven.

## `nextObserverResolutionDeadline`

Allows the resolver's full two-minute discovery window plus its final polling
margin, without crossing the buffered candidate expiry.

## `nextCandidateWorkflowDeadline`

Allows candidate deployment confirmation to use its workflow-aware duration,
bounded by the candidate's buffered expiry. The longest successful family is
restore: 120 seconds for the initial observer dispatch, 125 seconds to resolve
the observer, 120 seconds each for restore admission, candidate dispatch, and
attribution, 1,860 seconds for candidate confirmation, 120 seconds for signal
detection, and 125 seconds for uniqueness. The post-dispatch stages total
2,590 seconds; including observer dispatch gives 2,710 seconds (45 minutes 10
seconds), leaving 50 seconds inside the 46-minute listener without changing
any stage deadline. This total counts successful stage settlement only;
timeout-abort cleanup belongs to a failed attempt and does not extend the
valid success lifetime.

## `nextWorkflowDeadline`

Starts a fresh bounded deadline for a known provider workflow stage.

## `nextCleanupDeadline`

Grants a fresh bounded window for reconciliation or cleanup after an attributed
candidate must fail.

## `nextVerificationDeadline`

Starts a fresh post-closure verification window with one final polling margin.

## `waitForNoSignalUniqueness`

After rollback closure, uses a fresh bounded local verification window to wait
for the expected no-signal uniqueness failure. When the provider supplies a
true close it must remain stable and be reached; a missing or null provider
close is never replaced with local time.

## `serializePreviewRollbackSettlementInput`

Serializes the exact candidate and rollback binding used by the private
settlement gate.

## `rollbackCallDeadline`

Chooses the tighter local or provider rollback deadline after a signal.

## `monotonicDeadlineForWall`

Converts one validated wall-clock close into a local monotonic deadline.

## `cleanup`

Releases the child timer and abort listener after a command settles.

## `rejectClosed`

Rejects a child command with the controller's single public failure.

## `terminate`

Requests child termination while waiting for the child to close and be reaped.
