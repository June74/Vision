/** Defines deterministic, citation-backed scheduling proposals with an approval-only calendar boundary. */
import { z } from "zod";

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const timestamp = z.string().datetime({ offset: true });
const timeZone = z.string().min(1).max(255);
const sourceFactSchema = z.object({
  id: identifier,
  kind: z.enum([
    "calendar_event",
    "secretary_task",
    "secretary_capture",
    "secretary_note",
    "follow_up",
  ]),
  label: z.string().min(1).max(512),
}).strict();
const busyBlockSchema = z.object({
  id: identifier,
  title: z.string().max(512).optional(),
  startsAt: timestamp,
  endsAt: timestamp,
  timeZone,
  busy: z.boolean(),
  status: z.enum(["confirmed", "tentative", "cancelled"]),
  sourceFactId: identifier,
}).strict();
const schedulingInputSchema = z.object({
  proposalId: identifier,
  title: z.string().trim().min(1).max(512),
  durationMinutes: z.number().int().min(15).max(12 * 60),
  preferredStartAt: timestamp.nullable().optional(),
  window: z.object({
    startsAt: timestamp,
    endsAt: timestamp,
    timeZone,
  }).strict(),
  busyBlocks: z.array(busyBlockSchema).max(200),
  sourceFacts: z.array(sourceFactSchema).max(200),
  ambiguity: z.array(z.string().min(1).max(128)).max(16),
  aiRequested: z.boolean().optional(),
}).strict();

/** A short, owner-visible citation to an already trusted source fact. */
export interface PlanningSourceFact {
  readonly id: string;
  readonly kind:
    | "calendar_event"
    | "secretary_task"
    | "secretary_capture"
    | "secretary_note"
    | "follow_up";
  readonly label: string;
}

/** Planning-safe busy metadata with no provider token or protected envelope. */
export interface PlanningBusyBlock {
  readonly id: string;
  readonly title?: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly busy: boolean;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly sourceFactId: string;
}

/** Planning-safe local task facts used by briefings and source citations. */
export interface PlanningTaskFact {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly status: "open" | "completed";
  readonly sourceFactId: string;
}

/** Snapshot supplied by an authenticated, owner-scoped planning repository. */
export interface PlanningSourceSnapshot {
  readonly events: readonly PlanningBusyBlock[];
  readonly tasks: readonly PlanningTaskFact[];
  readonly followUps: readonly import("../follow-ups/follow-up").FollowUp[];
  readonly sourceFacts: readonly PlanningSourceFact[];
}

/** One source citation included in a proposal, briefing, or conflict. */
export interface PlanningCitation {
  readonly sourceFactId: string;
  readonly kind: PlanningSourceFact["kind"];
  readonly label: string;
}

/** One candidate slot returned after deterministic conflict evaluation. */
export interface SchedulingAlternative {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly localStart: string;
  readonly localEnd: string;
  readonly timeZone: string;
  readonly citations: readonly PlanningCitation[];
}

/** A hard conflict between the requested slot and a trusted busy source. */
export interface SchedulingConflict {
  readonly blockId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly sourceFactId: string;
  readonly citation: PlanningCitation;
}

/** The provider-independent scheduling result; it never contains a calendar write operation. */
export interface SchedulingProposal {
  readonly proposalId: string;
  readonly title: string;
  readonly durationMinutes: number;
  readonly preferredStartAt: string | null;
  readonly window: {
    readonly startsAt: string;
    readonly endsAt: string;
    readonly timeZone: string;
  };
  readonly status: "ready" | "conflict" | "needs_clarification";
  readonly ambiguity: readonly string[];
  readonly alternatives: readonly SchedulingAlternative[];
  readonly conflicts: readonly SchedulingConflict[];
  readonly citations: readonly PlanningCitation[];
  readonly automation: {
    readonly mode: "deterministic";
    readonly aiEnabled: false;
  };
  readonly calendarWrite: {
    readonly authority: "approval-required";
    readonly canConfirm: false;
    readonly approvalOperationId: string | null;
  };
}

/** Safe domain failure for malformed scheduling inputs. */
export class SchedulingProposalError extends Error {
  constructor() {
    super("Scheduling proposal is invalid.");
    this.name = "SchedulingProposalError";
  }
}

/** Explicit boundary failure when a caller tries to hand a proposal to a write path without approval. */
export class SchedulingApprovalRequiredError extends Error {
  constructor() {
    super("Calendar approval is required before a scheduling proposal can be handed to a write path.");
    this.name = "SchedulingApprovalRequiredError";
  }
}

/** Builds a conflict-aware proposal from trusted planning facts without invoking an AI provider. */
export function createSchedulingProposal(input: unknown): SchedulingProposal {
  const parsed = schedulingInputSchema.safeParse(input);
  if (!parsed.success) throw new SchedulingProposalError();
  const windowStart = parseInstant(parsed.data.window.startsAt);
  const windowEnd = parseInstant(parsed.data.window.endsAt);
  validateTimeZone(parsed.data.window.timeZone);
  if (windowEnd <= windowStart) throw new SchedulingProposalError();
  if (parsed.data.durationMinutes * 60_000 > windowEnd - windowStart) {
    throw new SchedulingProposalError();
  }

  const sourceFacts = uniqueSourceFacts(parsed.data.sourceFacts);
  const factsById = new Map(sourceFacts.map((fact) => [fact.id, fact]));
  const blocks = parsed.data.busyBlocks.map((block) => {
    validateTimeZone(block.timeZone);
    const startsAt = parseInstant(block.startsAt);
    const endsAt = parseInstant(block.endsAt);
    if (endsAt <= startsAt || !factsById.has(block.sourceFactId)) {
      throw new SchedulingProposalError();
    }
    return { ...block, startsAt, endsAt };
  });
  const preferredStart = parsed.data.preferredStartAt === undefined || parsed.data.preferredStartAt === null
    ? windowStart
    : parseInstant(parsed.data.preferredStartAt);
  if (preferredStart < windowStart || preferredStart + parsed.data.durationMinutes * 60_000 > windowEnd) {
    throw new SchedulingProposalError();
  }

  const citations = citationsForBlocks(blocks, factsById);
  if (parsed.data.ambiguity.length > 0) {
    return freezeProposal({
      proposalId: parsed.data.proposalId,
      title: parsed.data.title,
      durationMinutes: parsed.data.durationMinutes,
      preferredStartAt: parsed.data.preferredStartAt ?? null,
      window: parsed.data.window,
      status: "needs_clarification",
      ambiguity: parsed.data.ambiguity,
      alternatives: [],
      conflicts: [],
      citations: [],
      automation: { mode: "deterministic", aiEnabled: false },
      calendarWrite: { authority: "approval-required", canConfirm: false, approvalOperationId: null },
    });
  }

  const durationMs = parsed.data.durationMinutes * 60_000;
  const conflictBlocks = blocks.filter((block) =>
    isBlocking(block) && overlaps(preferredStart, preferredStart + durationMs, block.startsAt, block.endsAt));
  const candidates = candidateStarts(windowStart, windowEnd, preferredStart, durationMs)
    .filter((start) => !blocks.some((block) => isBlocking(block) && overlaps(start, start + durationMs, block.startsAt, block.endsAt)))
    .slice(0, 5)
    .map((start, index) => toAlternative(
      parsed.data.proposalId,
      index,
      start,
      start + durationMs,
      parsed.data.window.timeZone,
    ));
  const conflicts = conflictBlocks.map((block) => {
    const citation = citationFor(block.sourceFactId, factsById);
    return {
      blockId: block.id,
      startsAt: new Date(block.startsAt).toISOString(),
      endsAt: new Date(block.endsAt).toISOString(),
      sourceFactId: block.sourceFactId,
      citation,
    };
  });

  return freezeProposal({
    proposalId: parsed.data.proposalId,
    title: parsed.data.title,
    durationMinutes: parsed.data.durationMinutes,
    preferredStartAt: parsed.data.preferredStartAt ?? null,
    window: {
      startsAt: new Date(windowStart).toISOString(),
      endsAt: new Date(windowEnd).toISOString(),
      timeZone: parsed.data.window.timeZone,
    },
    status: conflicts.length > 0 || candidates.length === 0 ? "conflict" : "ready",
    ambiguity: [],
    alternatives: candidates,
    conflicts,
    citations,
    automation: { mode: "deterministic", aiEnabled: false },
    calendarWrite: { authority: "approval-required", canConfirm: false, approvalOperationId: null },
  });
}

/** Accepts only a pre-existing opaque approval operation from the shared calendar-write pipeline. */
export function assertCalendarApprovalOperation(
  proposal: SchedulingProposal,
  approvalOperationId: unknown,
): { readonly proposalId: string; readonly approvalOperationId: string; readonly canExecute: true } {
  if (
    proposal.status !== "ready" ||
    proposal.calendarWrite.canConfirm ||
    typeof approvalOperationId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(approvalOperationId)
  ) {
    throw new SchedulingApprovalRequiredError();
  }
  return { proposalId: proposal.proposalId, approvalOperationId, canExecute: true };
}

/** Formats an instant in an explicit IANA zone for person-facing proposal/briefing copy. */
export function formatPlanningLocalDateTime(value: string | Date, zone: string): string {
  validateTimeZone(zone);
  const instant = value instanceof Date ? value : new Date(parseInstant(value));
  if (!Number.isFinite(instant.getTime())) throw new SchedulingProposalError();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  /** Reads one required formatted timezone part without process-local defaults. */
  const valueFor = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  const year = valueFor("year");
  const month = valueFor("month");
  const day = valueFor("day");
  const hour = valueFor("hour");
  const minute = valueFor("minute");
  if (!year || !month || !day || !hour || !minute) throw new SchedulingProposalError();
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/** Rejects duplicate source identities before citations are assembled. */
function uniqueSourceFacts(facts: readonly z.infer<typeof sourceFactSchema>[]): readonly PlanningSourceFact[] {
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.id)) throw new SchedulingProposalError();
    ids.add(fact.id);
  }
  return facts;
}

/** Builds one deduplicated citation list from trusted blocking facts. */
function citationsForBlocks(
  blocks: readonly {
    readonly id: string;
    readonly startsAt: number;
    readonly endsAt: number;
    readonly sourceFactId: string;
  }[],
  factsById: ReadonlyMap<string, PlanningSourceFact>,
): readonly PlanningCitation[] {
  const citations: PlanningCitation[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    if (seen.has(block.sourceFactId)) continue;
    seen.add(block.sourceFactId);
    citations.push(citationFor(block.sourceFactId, factsById));
  }
  return citations;
}

/** Converts one trusted fact into the public citation shape. */
function citationFor(sourceFactId: string, factsById: ReadonlyMap<string, PlanningSourceFact>): PlanningCitation {
  const fact = factsById.get(sourceFactId);
  if (!fact) throw new SchedulingProposalError();
  return { sourceFactId, kind: fact.kind, label: fact.label };
}

/** Generates the preferred slot followed by deterministic fifteen-minute alternatives. */
function candidateStarts(
  windowStart: number,
  windowEnd: number,
  preferredStart: number,
  durationMs: number,
): readonly number[] {
  const starts: number[] = [];
  /** Adds one bounded, de-duplicated candidate instant. */
  const add = (start: number): void => {
    if (start < windowStart || start + durationMs > windowEnd || starts.includes(start)) return;
    starts.push(start);
  };
  add(preferredStart);
  for (let start = windowStart; start + durationMs <= windowEnd; start += 15 * 60_000) add(start);
  return starts;
}

/** Converts one UTC candidate into the owner-visible local-time alternative. */
function toAlternative(
  proposalId: string,
  index: number,
  startsAt: number,
  endsAt: number,
  zone: string,
): SchedulingAlternative {
  return {
    id: `${proposalId}:slot:${index + 1}`,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    localStart: formatPlanningLocalDateTime(new Date(startsAt), zone),
    localEnd: formatPlanningLocalDateTime(new Date(endsAt), zone),
    timeZone: zone,
    citations: [],
  };
}

/** Treats confirmed and tentative busy blocks as hard conflicts, excluding cancellations. */
function isBlocking(block: { readonly busy: boolean; readonly status: string }): boolean {
  return block.busy && block.status !== "cancelled";
}

/** Applies half-open interval overlap semantics to avoid false adjacent conflicts. */
function overlaps(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

/** Parses an explicit-offset timestamp into a finite UTC epoch value. */
function parseInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new SchedulingProposalError();
  return parsed;
}

/** Validates an IANA timezone through the runtime formatter. */
function validateTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new SchedulingProposalError();
  }
}

/** Freezes the proposal envelope so callers cannot mutate an approved preview. */
function freezeProposal(proposal: SchedulingProposal): SchedulingProposal {
  return Object.freeze(proposal);
}
