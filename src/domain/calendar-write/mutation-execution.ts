/** Executes one confirmed update, move, cancellation, or direct delete through verified provider facts. */
import type { SafeAuditEvent } from "../../audit/audit-event";
import {
  CalendarWriteProviderError,
  type CalendarWriteAudit,
  type CalendarWriteLedger,
  type CalendarWriteLedgerRecord,
  type CalendarWriteMutationProvider,
  type CalendarWriteMutationProviderInput,
  type CalendarWriteProviderEvent,
} from "./create-execution";
import {
  CalendarWriteContractError,
  type CalendarWriteMutationAction,
  type CalendarWriteMutationEvent,
  type CalendarWriteMutationProposal,
} from "./event-mutation";

export { CalendarWriteProviderError } from "./create-execution";
export type {
  CalendarWriteAudit,
  CalendarWriteLedger,
  CalendarWriteLedgerRecord,
  CalendarWriteMutationProvider,
  CalendarWriteProviderEvent,
} from "./create-execution";

/** Dependencies for one deterministic, owner-scoped mutation attempt. */
export interface CalendarWriteMutationExecutionDependencies {
  readonly provider: CalendarWriteMutationProvider;
  readonly ledger: CalendarWriteLedger;
  readonly audit: CalendarWriteAudit;
  readonly now: () => string;
}

/** Safe result returned only after exact post-mutation verification or explicit pending state. */
export interface CalendarWriteMutationExecutionResult {
  readonly status: "invalidated" | "verified" | "verification_pending" | "failed";
  readonly ownerId: string;
  readonly operationId: string;
  readonly proposal: CalendarWriteMutationProposal;
  readonly eventId?: string;
  readonly eventVersion?: string;
}

/** Executes one confirmed mutation with one freshness check and no blind provider retry. */
export async function executeConfirmedCalendarMutation(
  proposal: CalendarWriteMutationProposal,
  dependencies: CalendarWriteMutationExecutionDependencies,
): Promise<CalendarWriteMutationExecutionResult> {
  if (proposal.status !== "confirmed") {
    throw new CalendarWriteContractError("INVALID_STATE_TRANSITION");
  }

  const existing = await dependencies.ledger.find(
    proposal.ownerId,
    proposal.operationId,
  );
  if (existing) {
    return reconcileExistingMutation(proposal, existing, dependencies);
  }

  let current: CalendarWriteProviderEvent | undefined;
  try {
    current = await dependencies.provider.readEvent({
      calendarId: proposal.target.calendarId,
      eventId: proposal.target.eventId,
    });
  } catch {
    return pendingMutation(
      proposal,
      dependencies,
      "provider_uncertain",
      false,
    );
  }

  if (!current || !matchesTargetAndSnapshot(proposal, current, "before")) {
    const invalidated = staleMutation(proposal);
    await writeMutationAudit(
      dependencies,
      auditForMutation(proposal, "denied", dependencies.now(), "event_target_stale"),
    );
    return resultFor(invalidated, "invalidated");
  }

  const claim = await dependencies.ledger.claim(
    proposal.ownerId,
    proposal.operationId,
    proposal.target.calendarId,
  );
  if (claim === "existing") {
    const winner = await dependencies.ledger.find(
      proposal.ownerId,
      proposal.operationId,
    );
    if (winner) return reconcileExistingMutation(proposal, winner, dependencies);
    return pendingMutation(proposal, dependencies, "provider_uncertain", false);
  }

  const writing = withMutationStatus(proposal, "writing");
  try {
    if (proposal.action === "delete") {
      await dependencies.provider.deleteEvent({
        calendarId: proposal.target.calendarId,
        eventId: proposal.target.eventId,
        expectedVersion: proposal.target.version,
      });
    } else {
      await callMutationProvider(
        dependencies.provider,
        proposal.action,
        mutationInput(proposal),
      );
    }
  } catch (error) {
    if (isDefiniteProviderFailure(error)) {
      await markFailed(dependencies, proposal);
      await writeMutationAudit(
        dependencies,
        auditForMutation(proposal, "failed", dependencies.now(), "provider_failure"),
      );
      return resultFor(withMutationStatus(writing, "failed"), "failed");
    }
    return reconcileMutation(writing, dependencies, "provider_uncertain");
  }

  return reconcileMutation(writing, dependencies, "verification_mismatch");
}

/** Reconciles a previously claimed operation without issuing a second mutation. */
async function reconcileExistingMutation(
  proposal: CalendarWriteMutationProposal,
  record: CalendarWriteLedgerRecord,
  dependencies: CalendarWriteMutationExecutionDependencies,
): Promise<CalendarWriteMutationExecutionResult> {
  if (
    record.status === "verified" &&
    record.eventId !== undefined &&
    record.eventVersion !== undefined
  ) {
    return resultFor(withMutationStatus(proposal, "verified"), "verified", record);
  }
  if (record.status === "failed" || record.status === "undone") {
    return resultFor(withMutationStatus(proposal, "failed"), "failed", record);
  }
  return reconcileMutation(
    withMutationStatus(proposal, "writing"),
    dependencies,
    "provider_uncertain",
  );
}

/** Reads provider state once after the mutation attempt and marks only exact outcomes verified. */
async function reconcileMutation(
  proposal: CalendarWriteMutationProposal,
  dependencies: CalendarWriteMutationExecutionDependencies,
  pendingCategory: "provider_uncertain" | "verification_mismatch",
): Promise<CalendarWriteMutationExecutionResult> {
  let current: CalendarWriteProviderEvent | undefined;
  try {
    current = await dependencies.provider.readEvent({
      calendarId: proposal.target.calendarId,
      eventId: proposal.target.eventId,
    });
  } catch {
    return pendingMutation(proposal, dependencies, pendingCategory, true);
  }

  if (
    proposal.action === "delete"
      ? current === undefined
      : current !== undefined && matchesTargetAndSnapshot(proposal, current, "after")
  ) {
    const eventId = proposal.target.eventId;
    const eventVersion = current?.version ?? proposal.target.version;
    const verifiedLedger = await markVerified(
      dependencies,
      proposal,
      eventId,
      eventVersion,
    );
    if (!verifiedLedger) {
      return pendingMutation(proposal, dependencies, "provider_uncertain", true);
    }
    await writeMutationAudit(
      dependencies,
      auditForMutation(proposal, "succeeded", dependencies.now()),
    );
    return resultFor(
      withMutationStatus(proposal, "verified"),
      "verified",
      {
        ownerId: proposal.ownerId,
        operationId: proposal.operationId,
        calendarId: proposal.target.calendarId,
        status: "verified",
        eventId,
        eventVersion,
      },
    );
  }

  return pendingMutation(proposal, dependencies, pendingCategory, true);
}

/** Builds the provider-neutral mutation input from the immutable after preview. */
function mutationInput(
  proposal: CalendarWriteMutationProposal,
): CalendarWriteMutationProviderInput {
  const after = proposal.preview.after;
  if (after === null) throw new CalendarWriteContractError("INVALID_MUTATION_PREVIEW");
  return {
    calendarId: proposal.target.calendarId,
    eventId: proposal.target.eventId,
    expectedVersion: proposal.target.version,
    operationId: proposal.operationId,
    title: after.title,
    description: after.description,
    startsAt: after.startsAt,
    endsAt: after.endsAt,
    timeZone: after.timeZone,
    domain: after.domain,
    privacy: after.privacy,
    status: after.status,
    attendees: [],
    recurrence: null,
    notifications: "none",
  };
}

/** Calls only the provider method selected by the immutable action. */
async function callMutationProvider(
  provider: CalendarWriteMutationProvider,
  action: Exclude<CalendarWriteMutationAction, "delete">,
  input: CalendarWriteMutationProviderInput,
): Promise<CalendarWriteProviderEvent> {
  if (action === "update") return provider.updateEvent(input);
  if (action === "move") return provider.moveEvent(input);
  return provider.cancelEvent(input);
}

/** Compares provider identity and the exact disclosed event snapshot. */
function matchesTargetAndSnapshot(
  proposal: CalendarWriteMutationProposal,
  event: CalendarWriteProviderEvent,
  snapshot: "before" | "after",
): boolean {
  const expected = snapshot === "before" ? proposal.preview.before : proposal.preview.after;
  if (
    expected === null ||
    event.eventId !== proposal.target.eventId ||
    event.version !== proposal.target.version ||
    event.operationId !== proposal.operationId ||
    event.title !== expected.title ||
    event.description !== expected.description ||
    event.startsAt !== expected.startsAt ||
    event.endsAt !== expected.endsAt ||
    event.timeZone !== expected.timeZone ||
    event.domain !== expected.domain ||
    event.privacy !== expected.privacy ||
    event.status !== expected.status ||
    event.attendees.length !== 0 ||
    event.recurrence !== null ||
    event.notifications !== "none"
  ) {
    return false;
  }
  return true;
}

/** Returns the constant stale-target mutation value without invoking a provider mutation. */
function staleMutation(
  proposal: CalendarWriteMutationProposal,
): CalendarWriteMutationProposal {
  return Object.freeze({
    ...proposal,
    status: "invalidated" as const,
    invalidatedReason: "STALE_EVENT_VERSION" as const,
  });
}

/** Returns a new immutable proposal status for an execution result. */
function withMutationStatus(
  proposal: CalendarWriteMutationProposal,
  status: CalendarWriteMutationProposal["status"],
): CalendarWriteMutationProposal {
  return Object.freeze({
    ...proposal,
    status,
    ...(status === "invalidated"
      ? { invalidatedReason: "STALE_EVENT_VERSION" as const }
      : {}),
  });
}

/** Builds a safe execution result and only exposes opaque provider identity/version after verification. */
function resultFor(
  proposal: CalendarWriteMutationProposal,
  status: CalendarWriteMutationExecutionResult["status"],
  record?: CalendarWriteLedgerRecord,
): CalendarWriteMutationExecutionResult {
  return {
    status,
    ownerId: proposal.ownerId,
    operationId: proposal.operationId,
    proposal,
    ...(record?.eventId && record.eventVersion
      ? { eventId: record.eventId, eventVersion: record.eventVersion }
      : {}),
  };
}

/** Records pending state without upgrading an uncertain provider result. */
async function pendingMutation(
  proposal: CalendarWriteMutationProposal,
  dependencies: CalendarWriteMutationExecutionDependencies,
  errorCategory: "provider_uncertain" | "verification_mismatch",
  markLedger: boolean,
): Promise<CalendarWriteMutationExecutionResult> {
  if (markLedger) {
    try {
      await dependencies.ledger.markPending(proposal.ownerId, proposal.operationId);
    } catch {
      // An unavailable ledger cannot turn unknown provider state into success.
    }
  }
  await writeMutationAudit(
    dependencies,
    auditForMutation(proposal, "pending", dependencies.now(), errorCategory),
  );
  return resultFor(
    withMutationStatus(proposal, "verification_pending"),
    "verification_pending",
  );
}

/** Records a definite provider failure without reflecting provider details. */
async function markFailed(
  dependencies: CalendarWriteMutationExecutionDependencies,
  proposal: Pick<CalendarWriteMutationProposal, "ownerId" | "operationId">,
): Promise<void> {
  try {
    await dependencies.ledger.markFailed(proposal.ownerId, proposal.operationId);
  } catch {
    // The safe failed result remains authoritative for this attempt.
  }
}

/** Records verified provider identity and version after exact read-back. */
async function markVerified(
  dependencies: CalendarWriteMutationExecutionDependencies,
  proposal: CalendarWriteMutationProposal,
  eventId: string,
  eventVersion: string,
): Promise<boolean> {
  try {
    await dependencies.ledger.markVerified(
      proposal.ownerId,
      proposal.operationId,
      proposal.target.calendarId,
      eventId,
      eventVersion,
    );
    return true;
  } catch {
    return false;
  }
}

/** Writes only the closed audit event and never changes the provider result on sink failure. */
async function writeMutationAudit(
  dependencies: CalendarWriteMutationExecutionDependencies,
  event: SafeAuditEvent,
): Promise<void> {
  try {
    await dependencies.audit.write(event);
  } catch {
    // Audit availability cannot authorize or de-authorize a provider mutation.
  }
}

/** Creates a privacy-safe mutation lifecycle audit fact. */
function auditForMutation(
  proposal: Pick<CalendarWriteMutationProposal, "ownerId" | "operationId" | "action">,
  outcome: SafeAuditEvent["outcome"],
  occurredAt: string,
  errorCategory?: string,
): SafeAuditEvent {
  return {
    id: auditId(proposal.operationId, proposal.action, outcome, occurredAt, errorCategory),
    ownerId: auditOwnerId(proposal.ownerId),
    action: `calendar.event.${proposal.action}`,
    actorType: "user",
    occurredAt,
    outcome,
    provider: "google_calendar",
    ...(errorCategory ? { errorCategory } : {}),
  };
}

/** Builds a bounded opaque audit identity without retaining event content. */
function auditId(
  operationId: string,
  action: string,
  outcome: SafeAuditEvent["outcome"],
  occurredAt: string,
  errorCategory?: string,
): string {
  const safeOperation = operationId.toLowerCase().replace(/[^a-z0-9_-]/gu, "-");
  const safeAction = action.toLowerCase().replace(/[^a-z0-9_-]/gu, "-");
  const safeCategory = (errorCategory ?? "ok")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "-")
    .slice(0, 64);
  const safeTime = occurredAt
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const suffix = `${safeAction}-${outcome}-${safeCategory}-${safeTime}`;
  return `${safeOperation.slice(0, Math.max(1, 127 - suffix.length))}-${suffix}`;
}

/** Converts the authenticated owner identity to the safe audit alphabet. */
function auditOwnerId(ownerId: string): string {
  return ownerId.toLowerCase().replace(/[^a-z0-9_-]/gu, "-").slice(0, 128);
}

/** Recognizes only the closed provider outcome that is safe to mark failed. */
function isDefiniteProviderFailure(error: unknown): boolean {
  return (
    error instanceof CalendarWriteProviderError &&
    error.outcome === "definite_failure"
  );
}
