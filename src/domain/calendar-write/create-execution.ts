/** Executes one confirmed one-off create through provider-neutral ports. */
import type { SafeAuditEvent } from "../../audit/audit-event";
import type { Domain } from "../categorization/category";
import {
  CalendarWriteContractError,
  transitionCalendarWrite,
  type CalendarWriteProposal,
} from "./approval";

type ConcreteDomain = Exclude<Domain, "unresolved">;
type Privacy = "planning" | "private" | "restricted";

/** Safe provider outcome categories used to distinguish retryable uncertainty. */
export type CalendarWriteProviderOutcome = "definite_failure" | "uncertain";

/** Constant-text provider failure that never retains a response body or URL. */
export class CalendarWriteProviderError extends Error {
  constructor(readonly outcome: CalendarWriteProviderOutcome) {
    super("Calendar write provider request failed.");
    this.name = "CalendarWriteProviderError";
  }
}

/** One strictly normalized provider event used for exact post-write verification. */
export interface CalendarWriteProviderEvent {
  readonly eventId: string;
  readonly version: string;
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly operationId: string;
  readonly domain: ConcreteDomain;
  readonly privacy: Privacy;
  readonly attendees: readonly [];
  readonly recurrence: null;
  readonly notifications: "none";
}

/** Provider methods required by the verified one-off create pipeline. */
export interface CalendarWriteProvider {
  readCalendarVersion(
    calendarId: string,
  ): Promise<{ readonly calendarId: string; readonly version: string }>;
  createOneOffEvent(input: {
    readonly calendarId: string;
    readonly operationId: string;
    readonly title: string;
    readonly description: string | null;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly timeZone: string;
    readonly domain: ConcreteDomain;
    readonly privacy: Privacy;
    readonly attendees: readonly [];
    readonly recurrence: null;
    readonly notifications: "none";
  }): Promise<CalendarWriteProviderEvent>;
  findByOperationId(input: {
    readonly calendarId: string;
    readonly operationId: string;
  }): Promise<readonly CalendarWriteProviderEvent[]>;
  readEvent(input: {
    readonly calendarId: string;
    readonly eventId: string;
  }): Promise<CalendarWriteProviderEvent | undefined>;
  deleteEvent(input: {
    readonly calendarId: string;
    readonly eventId: string;
    readonly expectedVersion: string;
  }): Promise<"deleted" | "not_found">;
}

/** Durable metadata needed to replay or reconcile one owner-scoped operation. */
export interface CalendarWriteLedgerRecord {
  readonly ownerId: string;
  readonly operationId: string;
  readonly calendarId: string;
  readonly status:
    | "writing"
    | "verification_pending"
    | "verified"
    | "failed"
    | "undone";
  readonly eventId?: string;
  readonly eventVersion?: string;
}

/** Persistence port that stores only opaque operation and provider identities. */
export interface CalendarWriteLedger {
  find(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteLedgerRecord | undefined>;
  claim(
    ownerId: string,
    operationId: string,
    calendarId: string,
  ): Promise<"claimed" | "existing">;
  markPending(ownerId: string, operationId: string): Promise<void>;
  markVerified(
    ownerId: string,
    operationId: string,
    calendarId: string,
    eventId: string,
    eventVersion: string,
  ): Promise<void>;
  markFailed(ownerId: string, operationId: string): Promise<void>;
  markUndone(ownerId: string, operationId: string): Promise<void>;
}

/** Audit port that accepts only the existing closed privacy-safe audit type. */
export interface CalendarWriteAudit {
  write(event: SafeAuditEvent): Promise<void>;
}

/** Dependencies for one deterministic execution attempt. */
export interface CalendarWriteExecutionDependencies {
  readonly provider: CalendarWriteProvider;
  readonly ledger: CalendarWriteLedger;
  readonly audit: CalendarWriteAudit;
  readonly now: () => string;
}

/** Safe result returned after create execution; event content remains in the preview only. */
export type CalendarWriteExecutionResult = {
  readonly status:
    | "invalidated"
    | "verified"
    | "verification_pending"
    | "failed";
  readonly ownerId: string;
  readonly operationId: string;
  readonly proposal: CalendarWriteProposal;
  readonly eventId?: string;
  readonly eventVersion?: string;
  readonly undo?: {
    readonly ownerId: string;
    readonly operationId: string;
    readonly eventId: string;
    readonly eventVersion: string;
  };
};

/** Opaque owner/operation reference accepted by the compensating undo path. */
export interface CalendarWriteUndoRequest {
  readonly ownerId: string;
  readonly operationId: string;
}

/** Result of an undo attempt without claiming a provider state that was not read back. */
export interface CalendarWriteUndoResult {
  readonly status: "undone" | "verification_pending" | "failed";
  readonly ownerId: string;
  readonly operationId: string;
}

/** Executes one confirmed proposal with immediate target revalidation and no insert retry. */
export async function executeConfirmedCalendarCreate(
  proposal: CalendarWriteProposal,
  dependencies: CalendarWriteExecutionDependencies,
): Promise<CalendarWriteExecutionResult> {
  if (proposal.status !== "confirmed") {
    throw new CalendarWriteContractError("INVALID_STATE_TRANSITION");
  }

  const existing = await dependencies.ledger.find(
    proposal.ownerId,
    proposal.operationId,
  );
  if (existing) {
    return reconcileExisting(proposal, existing, dependencies);
  }

  let currentTarget: { readonly calendarId: string; readonly version: string };
  try {
    currentTarget = await dependencies.provider.readCalendarVersion(
      proposal.target.calendarId,
    );
  } catch {
    await writeAuditSafely(
      dependencies,
      auditForCreate(proposal, "failed", dependencies.now(), "provider_failure"),
    );
    return resultFor(proposal, "failed");
  }

  if (
    currentTarget.calendarId !== proposal.target.calendarId ||
    currentTarget.version !== proposal.target.version
  ) {
    const invalidated = withProposalStatus(proposal, "invalidated");
    await writeAuditSafely(
      dependencies,
      auditForCreate(
        proposal,
        "denied",
        dependencies.now(),
        "calendar_target_stale",
      ),
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
    if (winner) return reconcileExisting(proposal, winner, dependencies);
    await writeAuditSafely(
      dependencies,
      auditForCreate(proposal, "pending", dependencies.now(), "provider_uncertain"),
    );
    return resultFor(proposal, "verification_pending");
  }

  const writing = transitionCalendarWrite(proposal, { kind: "begin_write" });
  let created: CalendarWriteProviderEvent;
  try {
    created = await dependencies.provider.createOneOffEvent({
      calendarId: proposal.target.calendarId,
      operationId: proposal.operationId,
      title: proposal.preview.after.title,
      description: proposal.preview.after.description,
      startsAt: proposal.preview.after.startsAt,
      endsAt: proposal.preview.after.endsAt,
      timeZone: proposal.preview.after.timeZone,
      domain: proposal.preview.after.domain,
      privacy: proposal.preview.after.privacy,
      attendees: [],
      recurrence: null,
      notifications: "none",
    });
  } catch (error) {
    if (isDefiniteProviderFailure(error)) {
      await markFailedSafely(dependencies, proposal);
      await writeAuditSafely(
        dependencies,
        auditForCreate(proposal, "failed", dependencies.now(), "provider_failure"),
      );
      return resultFor(withProposalStatus(writing, "failed"), "failed");
    }
    return reconcileUncertain(writing, dependencies);
  }

  return verifyCreated(writing, created, dependencies);
}

/** Undoes one verified event and confirms absence before reporting completion. */
export async function undoVerifiedCalendarCreate(
  request: CalendarWriteUndoRequest,
  dependencies: CalendarWriteExecutionDependencies,
): Promise<CalendarWriteUndoResult> {
  const record = await dependencies.ledger.find(
    request.ownerId,
    request.operationId,
  );
  if (record?.status === "undone") {
    return { ...request, status: "undone" };
  }
  if (
    !record ||
    record.status !== "verified" ||
    record.eventId === undefined ||
    record.eventVersion === undefined
  ) {
    await writeAuditSafely(
      dependencies,
      auditForUndo(request, "denied", dependencies.now(), "undo_not_verified"),
    );
    return { ...request, status: "failed" };
  }

  let deletion: "deleted" | "not_found";
  try {
    deletion = await dependencies.provider.deleteEvent({
      calendarId: record.calendarId,
      eventId: record.eventId,
      expectedVersion: record.eventVersion,
    });
  } catch {
    await markPendingSafely(dependencies, request);
    await writeAuditSafely(
      dependencies,
      auditForUndo(request, "pending", dependencies.now(), "undo_uncertain"),
    );
    return { ...request, status: "verification_pending" };
  }

  if (deletion === "not_found") {
    await markUndoneSafely(dependencies, request);
    await writeAuditSafely(
      dependencies,
      auditForUndo(request, "succeeded", dependencies.now()),
    );
    return { ...request, status: "undone" };
  }

  try {
    const remaining = await dependencies.provider.readEvent({
      calendarId: record.calendarId,
      eventId: record.eventId,
    });
    if (remaining !== undefined) {
      await markPendingSafely(dependencies, request);
      await writeAuditSafely(
        dependencies,
        auditForUndo(request, "pending", dependencies.now(), "undo_uncertain"),
      );
      return { ...request, status: "verification_pending" };
    }
  } catch {
    await markPendingSafely(dependencies, request);
    await writeAuditSafely(
      dependencies,
      auditForUndo(request, "pending", dependencies.now(), "undo_uncertain"),
    );
    return { ...request, status: "verification_pending" };
  }

  await markUndoneSafely(dependencies, request);
  await writeAuditSafely(
    dependencies,
    auditForUndo(request, "succeeded", dependencies.now()),
  );
  return { ...request, status: "undone" };
}

/** Reconciles an owner-scoped ledger record without issuing a duplicate insert. */
async function reconcileExisting(
  proposal: CalendarWriteProposal,
  record: CalendarWriteLedgerRecord,
  dependencies: CalendarWriteExecutionDependencies,
): Promise<CalendarWriteExecutionResult> {
  if (record.status === "verified" && record.eventId && record.eventVersion) {
    return resultFor(withProposalStatus(proposal, "verified"), "verified", record);
  }
  if (record.status === "failed") return resultFor(withProposalStatus(proposal, "failed"), "failed");
  if (record.status === "undone") return resultFor(withProposalStatus(proposal, "failed"), "failed");
  return reconcileUncertain(withProposalStatus(proposal, "writing"), dependencies);
}

/** Resolves an ambiguous create only through the private operation marker. */
async function reconcileUncertain(
  proposal: CalendarWriteProposal,
  dependencies: CalendarWriteExecutionDependencies,
): Promise<CalendarWriteExecutionResult> {
  let matches: readonly CalendarWriteProviderEvent[];
  try {
    matches = await dependencies.provider.findByOperationId({
      calendarId: proposal.target.calendarId,
      operationId: proposal.operationId,
    });
  } catch {
    return pendingResult(proposal, dependencies, "provider_uncertain");
  }
  if (matches.length !== 1) {
    return pendingResult(proposal, dependencies, "provider_uncertain");
  }
  return verifyCreated(proposal, matches[0]!, dependencies);
}

/** Reads one provider event back and verifies every approved field before success. */
async function verifyCreated(
  proposal: CalendarWriteProposal,
  created: CalendarWriteProviderEvent,
  dependencies: CalendarWriteExecutionDependencies,
): Promise<CalendarWriteExecutionResult> {
  let readBack: CalendarWriteProviderEvent | undefined;
  try {
    readBack = await dependencies.provider.readEvent({
      calendarId: proposal.target.calendarId,
      eventId: created.eventId,
    });
  } catch {
    return pendingResult(proposal, dependencies, "provider_uncertain");
  }
  if (!readBack || !matchesPreview(proposal, readBack)) {
    return pendingResult(proposal, dependencies, "verification_mismatch");
  }

  try {
    await dependencies.ledger.markVerified(
      proposal.ownerId,
      proposal.operationId,
      proposal.target.calendarId,
      readBack.eventId,
      readBack.version,
    );
  } catch {
    return pendingResult(proposal, dependencies, "provider_uncertain");
  }
  const verified = transitionCalendarWrite(proposal, { kind: "verified" });
  await writeAuditSafely(
    dependencies,
    auditForCreate(proposal, "succeeded", dependencies.now()),
  );
  return resultFor(verified, "verified", {
    ownerId: proposal.ownerId,
    operationId: proposal.operationId,
    calendarId: proposal.target.calendarId,
    status: "verified",
    eventId: readBack.eventId,
    eventVersion: readBack.version,
  });
}

/** Records a conservative pending result when provider state is not proven. */
async function pendingResult(
  proposal: CalendarWriteProposal,
  dependencies: CalendarWriteExecutionDependencies,
  errorCategory: "provider_uncertain" | "verification_mismatch",
): Promise<CalendarWriteExecutionResult> {
  await markPendingSafely(dependencies, proposal);
  await writeAuditSafely(
    dependencies,
    auditForCreate(proposal, "pending", dependencies.now(), errorCategory),
  );
  return resultFor(
    withProposalStatus(proposal, "verification_pending"),
    "verification_pending",
  );
}

/** Compares normalized provider state with the immutable approved preview. */
function matchesPreview(
  proposal: CalendarWriteProposal,
  event: CalendarWriteProviderEvent,
): boolean {
  const expected = proposal.preview.after;
  return (
    event.operationId === proposal.operationId &&
    event.title === expected.title &&
    event.description === expected.description &&
    event.startsAt === expected.startsAt &&
    event.endsAt === expected.endsAt &&
    event.timeZone === expected.timeZone &&
    event.domain === expected.domain &&
    event.privacy === expected.privacy &&
    event.attendees.length === 0 &&
    event.recurrence === null &&
    event.notifications === "none"
  );
}

/** Builds a safe execution result and optional opaque undo metadata. */
function resultFor(
  proposal: CalendarWriteProposal,
  status: CalendarWriteExecutionResult["status"],
  record?: CalendarWriteLedgerRecord,
): CalendarWriteExecutionResult {
  const eventId = record?.eventId;
  const eventVersion = record?.eventVersion;
  return {
    status,
    ownerId: proposal.ownerId,
    operationId: proposal.operationId,
    proposal,
    ...(eventId && eventVersion
      ? {
          eventId,
          eventVersion,
          undo: {
            ownerId: proposal.ownerId,
            operationId: proposal.operationId,
            eventId,
            eventVersion,
          },
        }
      : {}),
  };
}

/** Copies a proposal into a new lifecycle status without mutating the input. */
function withProposalStatus(
  proposal: CalendarWriteProposal,
  status: CalendarWriteProposal["status"],
): CalendarWriteProposal {
  return Object.freeze({
    ...proposal,
    status,
    ...(status === "invalidated"
      ? { invalidatedReason: "STALE_TARGET_VERSION" as const }
      : {}),
  });
}

/** Recognizes only the closed provider outcome that is safe to mark failed. */
function isDefiniteProviderFailure(error: unknown): boolean {
  return (
    error instanceof CalendarWriteProviderError &&
    error.outcome === "definite_failure"
  );
}

/** Best-effort ledger transition that never upgrades an unknown provider result. */
async function markPendingSafely(
  dependencies: CalendarWriteExecutionDependencies,
  proposal: Pick<CalendarWriteProposal, "ownerId" | "operationId">,
): Promise<void> {
  try {
    await dependencies.ledger.markPending(proposal.ownerId, proposal.operationId);
  } catch {
    // An unavailable ledger cannot turn an unknown provider result into success.
  }
}

/** Best-effort failed ledger transition after a definite provider rejection. */
async function markFailedSafely(
  dependencies: CalendarWriteExecutionDependencies,
  proposal: Pick<CalendarWriteProposal, "ownerId" | "operationId">,
): Promise<void> {
  try {
    await dependencies.ledger.markFailed(proposal.ownerId, proposal.operationId);
  } catch {
    // The safe failed result remains authoritative for this in-process attempt.
  }
}

/** Best-effort ledger transition after provider absence is verified. */
async function markUndoneSafely(
  dependencies: CalendarWriteExecutionDependencies,
  request: CalendarWriteUndoRequest,
): Promise<void> {
  try {
    await dependencies.ledger.markUndone(request.ownerId, request.operationId);
  } catch {
    // A failed ledger mark prevents a stronger claim; the audit/result remain safe.
  }
}

/** Sends only closed audit facts while preserving the execution outcome on sink failure. */
async function writeAuditSafely(
  dependencies: CalendarWriteExecutionDependencies,
  event: SafeAuditEvent,
): Promise<void> {
  try {
    await dependencies.audit.write(event);
  } catch {
    // Audit availability must not change the safe provider outcome.
  }
}

/** Creates one privacy-safe audit fact for the calendar-create lifecycle. */
function auditForCreate(
  proposal: Pick<CalendarWriteProposal, "ownerId" | "operationId">,
  outcome: SafeAuditEvent["outcome"],
  occurredAt: string,
  errorCategory?: string,
): SafeAuditEvent {
  return {
    id: auditId(proposal.operationId, "create", outcome, occurredAt, errorCategory),
    ownerId: auditOwnerId(proposal.ownerId),
    action: "calendar.event.create",
    actorType: "user",
    occurredAt,
    outcome,
    provider: "google_calendar",
    ...(errorCategory ? { errorCategory } : {}),
  };
}

/** Creates one privacy-safe audit fact for the compensating undo lifecycle. */
function auditForUndo(
  request: CalendarWriteUndoRequest,
  outcome: SafeAuditEvent["outcome"],
  occurredAt: string,
  errorCategory?: string,
): SafeAuditEvent {
  return {
    id: auditId(request.operationId, "undo", outcome, occurredAt, errorCategory),
    ownerId: auditOwnerId(request.ownerId),
    action: "calendar.event.undo",
    actorType: "user",
    occurredAt,
    outcome,
    provider: "google_calendar",
    ...(errorCategory ? { errorCategory } : {}),
  };
}

/** Builds a bounded audit identity that distinguishes lifecycle observations. */
function auditId(
  operationId: string,
  suffix: string,
  outcome: SafeAuditEvent["outcome"],
  occurredAt: string,
  errorCategory?: string,
): string {
  const safe = operationId.toLowerCase().replace(/[^a-z0-9_-]/gu, "-");
  const safeCategory = (errorCategory ?? "ok")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, "-")
    .slice(0, 64);
  const safeTime = occurredAt
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const suffixText = `${suffix}-${outcome}-${safeCategory}-${safeTime}`;
  const operationBudget = Math.max(1, 127 - suffixText.length);
  return `${safe.slice(0, operationBudget)}-${suffixText}`;
}

/** Converts an owner identity to the audit contract's opaque identifier form. */
function auditOwnerId(ownerId: string): string {
  return ownerId.toLowerCase().replace(/[^a-z0-9_-]/gu, "-").slice(0, 128);
}
