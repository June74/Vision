# run-preview-acceptance-controller

Coordinates immutable-ref checks, observer resolution, approval/action timing,
rollback, closure, and delayed uniqueness through one fail-closed state
machine. Provider run handles remain inside the observer port, and executable
stdout contains only a closed status vocabulary.

## `createPreviewControllerSubprocessDependencies`

Creates the concrete command adapter from a bounded driver command and
repository. It captures child streams with `execFile`, never invokes a shell,
requires exact one-line JSON driver replies, and implements every controller
dependency with fixed operation names and payload shapes.

## `invoke`

Runs one executable plus argument array through the injected or production
runner and maps execution, output, and parse failures to the controller error.

## `invokeDriver`

Serializes a bounded ordinary value as one driver argument, invokes one closed
driver operation, and parses its single JSON reply.

## `expectOk`

Requires the exact ordinary `{ ok: true }` acknowledgement and rejects extra
keys, accessors, symbols, or alternate truthy values.

## `assertRemoteTip`

Uses one captured `git ls-remote --heads` call for the fixed reviewed branch
reference and requires its sole returned SHA to equal the reviewed commit.

## `dispatch`

Rechecks the remote tip in the immediate pre-dispatch hook, serializes one
canonical acceptance context, and admits only an exact positive-decimal
`runRef` driver response. Candidate and rollback uncertainty are reconciled
under a new bounded deadline with a frozen exact operation/context/commit
tuple. A timed-out candidate is marked for mandatory rollback. An uncertain
rollback is never redispatched; an exactly reconciled run is attributed before
settlement and closure, after which the attempt remains failed closed.

## `resolveObserver`

Sends the immutable workflow, SHA, dispatch interval, family, and optional
maintenance tick to the driver and accepts only one opaque handle response.

## `readObserverState`

Reads the handle/family pair and snapshots only the closed signal,
uniqueness, and optional canonical listener timestamp fields.

## `verifyCandidateAttribution`

Sends the candidate run/commit pair and requires the exact acknowledgement.

## `awaitRollbackSettlement`

Invokes the closed `await-rollback-settlement` driver operation with the exact
candidate, rollback, operation, family, and commit binding. Closure dispatch is
not admitted until the driver returns the exact acknowledgement.

## `admitRestore`

Invokes the closed `admit-restore` driver operation with the non-baseline
candidate/closure references and reviewed commit. The controller accepts only
the exact derived `verified` attestation and never accepts it from input.

## `requestApproval`

Serializes the closed approval input and admits only an exact canonical
approval timestamp response.

## `performAction`

Serializes the closed action input and admits only an exact canonical action
completion timestamp response.

## `verifyClosure`

Sends the commit, candidate, rollback, and closure-run bindings and requires
the exact acknowledgement.

## `writeStatus`

Rejects any status outside the exported closed vocabulary before stdout.

## `runPreviewAcceptanceController`

Snapshots the complete input before remote work, verifies the remote tip on
every dispatch, dispatches observation before a candidate, and keeps
maintenance observation-only. Candidate families must pass attribution,
pre-action idle, any required approval/action, signal timing, a single latched
rollback, closure verification, and only then delayed uniqueness. A
non-positive no-signal window, reversed timestamp, provider/local deadline
miss, action completion later than the paired wall sample, unexpected observer
state, retry after an uncertain rollback, or action after a timeout-reconciled
candidate fails closed through one constant error surface. For two-job
families, a successful provider completion may advance the cached uniqueness
close monotonically. The controller rejects backward movement or advancement
beyond provider timestamp uncertainty, recomputes the semantic deadline, and
caps all such extensions at one candidate-workflow verification ceiling. It
still cannot accept uniqueness before the current close. Maintenance evidence
whose semantic close exceeds the 46-minute listener envelope is rejected
before observer dispatch and resolution.

## `rollbackAndClose`

Sets the rollback-attempt latch before the first dispatch, performs the final
local/provider deadline check, and applies that strict deadline only through
rollback dispatch. Rollback settlement receives a fresh rollback-workflow
deadline, closure dispatch receives a fresh strict dispatch deadline, and
closure verification receives a fresh closure-workflow deadline. Once the
latch is set, the controller never retries an ambiguous mutation.

## `waitForSignal`

Polls every five seconds against paired wall/monotonic samples and the absolute
earlier of action completion plus 120 seconds or expiry minus 60 seconds. It
rejects local or provider timestamps one millisecond late while admitting the
exact boundary. A provider signal later than the paired local detection sample
fails before remote-tip or rollback acceptance, then enters the ordinary
single cleanup path.

## `assertPreActionIdleDeadline`

Requires the action-start boundary to precede expiry by the fixed 180-second
idle allowance.

## `assertRollbackDispatchDeadline`

Runs immediately before rollback dispatch and enforces both independent
bounds: no more than 50 seconds since local detection and no more than 59
seconds since the provider listener completed.

## `waitForMaintenanceUniqueness`

Polls only the already-running normal maintenance uniqueness observer.
Semantic success remains anchored to scheduled tick plus 120 seconds and is
never accepted while the paired local wall is earlier. Paired wall and
monotonic deadlines permit provider settlement through close plus another
120 seconds, inclusive, and reject either clock one millisecond later.

## `createObserveContext`

Builds the canonical `observe` context with exact family/outcome pairing,
fault scenario when required, and only the maintenance scheduled tick. The
fixed tick-plus-120 close is derived internally and the removed close key is
not serialized. Non-maintenance setup/deploy time cannot consume uniqueness.

## `createCandidateContext`

Builds the canonical candidate context with reviewed commit, attribution,
authenticated-read gate, previous closure reference, and the inclusive
observer dispatch interval.

## `candidateOperation`

Maps every non-maintenance family to one provider-neutral candidate operation;
maintenance has no candidate mapping.

## `isTwoJobFamily`

Recognizes only suppression and restore, whose fast signal and two-minute
uniqueness states are polled independently.

## `isUserMediatedFamily`

Distinguishes explicit approval/action families from candidates whose
completion is confirmed through the scheduled observer path.

## `validCommit`

Requires one complete lowercase hexadecimal reviewed SHA without coercion.

## `validRunRef`

Requires one positive decimal provider reference with no leading zero.

## `canonicalDate`

Requires the millisecond UTC grammar and round-trip identity.

## `safeNow`

Validates a dependency-supplied `Date` and returns a defensive copy.

## `safeMonotonic`

Requires one finite monotonic number without coercion.

## `createInProcessObserverPort`

Composes the shared resolver and observer-state readers while retaining the
branded run handle inside one closure. It forwards the controller's exact outer
deadline and abort signal to resolution plus the signal, two-job, and
maintenance readers. The two-job `uniquenessClosesAt` value is returned through
the controller snapshot without replacement.

## `snapshotObserverResolutionInput`

Validates and copies the exact workflow, commit, dispatch bounds, family, and
optional maintenance tick passed to the resolver.

## `snapshotControllerObserverState`

Reconstructs only the closed state fields returned by a custom observer port
and canonicalizes the optional provider timestamp. Absent and null uniqueness
close values remain distinct from provider-attributed dates and are never
replaced with controller wall time.

## `snapshotControllerInput`

Rejects accessors, symbols, aliases, extra keys, mismatched family
expectations, invalid lifecycle references, noncanonical expiry, and invalid
restore or maintenance fields before any dependency is called.

## `snapshotExpectation`

Reconstructs the exact family-specific expectation, including fault scenario
or maintenance tick, from untrusted input.

## `maintenanceObserverClosesAt`

Derives a fresh close instant exactly 120 seconds after the canonical
maintenance scheduled tick.

## `assertMaintenanceObserverFitsListenerEnvelope`

Computes the maintenance semantic-close offset from the observer-start wall
sample and accepts the exact inclusive 46-minute boundary. A negative offset
or one millisecond beyond the listener fails before any observer dispatch or
resolution call.

## `serializePreviewApprovalInput`

Snapshots the exact family, reviewed commit, candidate reference, and expiry
used by the approval driver operation.

## `serializePreviewActionInput`

Snapshots the exact action fields and family-specific expectation used by the
action driver operation.

## `serializePreviewClosureInput`

Snapshots the reviewed commit plus candidate, rollback, and closure references
used by closure verification.

## `validateActionInput`

Applies common commit/reference/date checks and family/expectation agreement
before either approval or action serialization.

## `runCapturedCommand`

Uses `execFile` with bounded buffers, UTF-8 capture, and hidden child windows.
Neither child stream is inherited or forwarded.

## `parseDriverJsonLine`

Requires exactly one nonempty JSON line and returns its parsed value without
rendering rejected content.

## `serializeDriverInput`

Snapshots one driver value, emits whitespace-free JSON, and enforces the fixed
input-byte ceiling.

## `snapshotDriverValue`

Recursively copies only bounded primitives, arrays, and ordinary enumerable own
data properties to a fixed depth; accessors, symbols, cycles, and unsupported
values fail closed.

## `readDriverDate`

Requires an exact one-key `{ at }` response and returns its canonical date.

## `boundedCommandPart`

Requires a nonempty bounded executable or prefix argument with no NUL.

## `boundedDriverArgument`

Requires a nonempty bounded driver argument and passes it directly as an
argument-array element.

## `boundedRepository`

Requires one owner/repository identifier from the closed safe character set.

## `exactRecord`

Requires `Object.prototype`, exact keys, enumerable data descriptors, and no
symbols.

## `exactRecordWithOptional`

Requires every mandatory key and permits only the named optional keys, with the
same ordinary-data constraints.

## `ownData`

Returns one required enumerable own data descriptor without invoking accessors.

## `optionalOwnData`

Returns one optional enumerable own data descriptor and rejects an accessor if
present.

## `isControllerFamily`

Recognizes only the seven controller evidence families.

## `isObserverState`

Recognizes only `listening`, `succeeded`, and `failed`.

## `isControllerStatus`

Recognizes only the fixed status tokens allowed on stdout.

## `validLifecycleRunRef`

Requires `baseline` or one positive bounded decimal lifecycle reference.

## `parseControllerArguments`

Parses the executable's exact bounded input-file and driver command arguments,
rejecting aliases, duplicates, missing values, and positional extras.

## `main`

Reads and snapshots the bounded controller input, creates the concrete process
dependencies, and runs the state machine. It keeps stderr empty, prevents a
duplicate failure status, and emits exactly one `failed_closed` status with
exit code 1 on any pre-run, child, protocol, or controller failure.

## `fail`

Throws the sole value-free controller error.

## `reconcileCandidateDispatch`

Performs one bounded accepted-then-throw reconciliation using the canonical
operation, serialized context, and reviewed commit. A missing or malformed
receipt fails closed; the controller never redispatches the candidate.

## `runControllerCall`

Clamps a requested absolute monotonic deadline to the caller-selected stage
ceiling, supplies an `AbortSignal`, clears its timer on settlement, and converts
every dependency failure into the constant public error.

## `nextPreSignalDeadline`

Derives an ordinary pre-signal absolute monotonic deadline from the uniqueness
ceiling and buffered candidate expiry, rejecting exhausted or invalid time.

## `nextObserverResolutionDeadline`

Derives an expiry-bounded 125-second outer deadline so the resolver can use its
120-second discovery window and five-second terminal metadata settlement poll.

## `nextCandidateWorkflowDeadline`

Derives a candidate-confirmation deadline from the 30-minute workflow duration
plus settlement margin, capped by the buffered candidate expiry. The workflow
observer lifetime is derived separately from the longest successful family,
restore: 120 seconds of initial observer dispatch, 125 seconds of resolver
startup, 120 seconds of restore admission, 120 seconds of candidate dispatch,
120 seconds of candidate attribution, 1,860 seconds of candidate confirmation,
120 seconds of signal detection, and 125 seconds of uniqueness settlement. The
post-dispatch stages total 2,590 seconds. Including observer dispatch yields
2,710 seconds, or 45 minutes 10 seconds, which fits the rounded 46-minute
listener with 50 seconds of slack. These are sequential successful-settlement
ceilings; an aborted stage and its mandatory cleanup describe a failed attempt
and are not added to the listener's valid success lifetime. Every existing
per-stage controller bound remains unchanged.

## `nextWorkflowDeadline`

Allocates a fresh absolute monotonic deadline for a supplied bounded provider
workflow duration after the preceding lifecycle stage settles.

## `nextCleanupDeadline`

Starts a fresh bounded monotonic window for reconciliation or post-dispatch
cleanup so an exhausted observer, expiry, or rollback-dispatch boundary cannot
prevent mandatory rollback settlement and closure.

## `nextVerificationDeadline`

Allocates a new post-closure monotonic verification window plus one terminal
poll margin, independent of the earlier signal cutoff and rollback deadline.

## `waitForNoSignalUniqueness`

Reads under a newly allocated post-closure monotonic deadline and accepts
exactly the expected listening-signal plus failed-uniqueness terminal. If the
provider returns a semantic close, every later read must preserve it and the
terminal cannot precede it. If the provider returns null or omits the close,
the local deadline bounds polling but is never promoted to provider evidence.

## `serializePreviewRollbackSettlementInput`

Validates the action fields and rollback run reference, then serializes only
the exact reviewed-commit, family, operation, candidate, and rollback binding
for the settlement driver.

## `rollbackCallDeadline`

Combines the signal-relative local deadline with the provider-observed wall
deadline. The returned child boundary is exclusive by one millisecond so the
documented inclusive rollback instant remains executable.

## `monotonicDeadlineForWall`

Validates a future wall-clock close and projects its remaining duration onto
the controller's monotonic clock.

## `cleanup`

Clears the per-command timer and removes the abort listener exactly once after
the child invocation settles.

## `rejectClosed`

Rejects the subprocess boundary with only the constant public controller
failure, never with child output or provider-controlled text.

## `terminate`

Marks termination requested and signals the child, while leaving settlement to
the close callback so the process is reaped before control returns.
