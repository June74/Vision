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
`runRef` driver response.

## `resolveObserver`

Sends the immutable workflow, SHA, dispatch interval, family, and optional
maintenance tick to the driver and accepts only one opaque handle response.

## `readObserverState`

Reads the handle/family pair and snapshots only the closed signal,
uniqueness, and optional canonical listener timestamp fields.

## `verifyCandidateAttribution`

Sends the candidate run/commit pair and requires the exact acknowledgement.

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
state, or retry after an uncertain rollback fails closed through one constant
error surface.

## `rollbackAndClose`

Sets the rollback-attempt latch before the first dispatch, performs the final
local/provider deadline check, dispatches rollback, dispatches closure, and
verifies the closure artifact. Once the latch is set, the controller will not
retry an ambiguous mutation.

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
branded run handle inside one closure.

## `snapshotObserverResolutionInput`

Validates and copies the exact workflow, commit, dispatch bounds, family, and
optional maintenance tick passed to the resolver.

## `snapshotControllerObserverState`

Reconstructs only the closed state fields returned by a custom observer port
and canonicalizes the optional provider timestamp.

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

Clamps a requested absolute monotonic deadline to the controller ceiling,
supplies an `AbortSignal`, clears its timer on settlement, and converts every
dependency failure into the constant public error.

## `nextPreSignalDeadline`

Derives an absolute monotonic deadline from the remaining observer window and
the buffered candidate expiry, rejecting exhausted or invalid time.

## `nextCleanupDeadline`

Starts a fresh bounded monotonic cleanup window after candidate attribution so
expiry rejection cannot prevent mandatory rollback and closure.

## `waitForNoSignalUniqueness`

Reads only through the bounded post-closure settlement interval and accepts
exactly the expected listening-signal plus failed-uniqueness terminal.

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
