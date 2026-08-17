/** Builds explicit-window template briefings from trusted owner-scoped planning facts. */
import {
  formatPlanningLocalDateTime,
  type PlanningCitation,
  type PlanningSourceFact,
  type PlanningBusyBlock,
  type PlanningTaskFact,
} from "../scheduling/proposal";
import type { FollowUp } from "../follow-ups/follow-up";

/** One explicit local-time window from which a briefing may read owner-scoped facts. */
export interface BriefingWindow {
  readonly kind: "morning" | "afternoon" | "evening" | "custom";
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
}

/** Template-backed briefing section with typed item records. */
export interface BriefingSection {
  readonly kind: "calendar" | "tasks" | "follow_ups";
  readonly title: string;
  readonly items: readonly BriefingItem[];
}

/** Person-facing briefing item retaining only the source citation and exact times needed for action. */
export interface BriefingItem {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly localTime: string | null;
  readonly status: string;
  readonly sourceFactId: string;
}

/** Deterministic briefing output with explicit no-write and no-AI markers. */
export interface Briefing {
  readonly briefingId: string;
  readonly window: BriefingWindow;
  readonly sections: readonly BriefingSection[];
  readonly citations: readonly PlanningCitation[];
  readonly automation: { readonly mode: "template"; readonly aiEnabled: false };
  readonly calendarWrite: { readonly authority: "approval-required"; readonly canConfirm: false };
}

/** Builds a stable briefing from trusted source facts and an explicit time window. */
export function buildBriefing(input: {
  readonly briefingId: string;
  readonly window: BriefingWindow;
  readonly events: readonly PlanningBusyBlock[];
  readonly tasks: readonly PlanningTaskFact[];
  readonly followUps: readonly FollowUp[];
  readonly sourceFacts: readonly PlanningSourceFact[];
}): Briefing {
  const start = parseInstant(input.window.startsAt);
  const end = parseInstant(input.window.endsAt);
  if (end <= start || input.briefingId.length === 0) throw new Error("Briefing input is invalid.");
  const facts = new Map(input.sourceFacts.map((fact) => [fact.id, fact]));
  const citations: PlanningCitation[] = [];
  /** Adds each source fact once while omitting unknown identifiers from public copy. */
  const addCitation = (id: string): void => {
    const fact = facts.get(id);
    if (!fact || citations.some((citation) => citation.sourceFactId === id)) return;
    citations.push({ sourceFactId: id, kind: fact.kind, label: fact.label });
  };
  const calendarItems = input.events
    .filter((event) => overlaps(start, end, parseInstant(event.startsAt), parseInstant(event.endsAt)))
    .sort((left, right) => parseInstant(left.startsAt) - parseInstant(right.startsAt) || left.id.localeCompare(right.id))
    .map((event) => {
      addCitation(event.sourceFactId);
      return {
        id: event.id,
        title: event.title ?? "Calendar event",
        startsAt: new Date(parseInstant(event.startsAt)).toISOString(),
        endsAt: new Date(parseInstant(event.endsAt)).toISOString(),
        localTime: formatPlanningLocalDateTime(event.startsAt, input.window.timeZone),
        status: event.status,
        sourceFactId: event.sourceFactId,
      };
    });
  const taskItems = input.tasks
    .filter((task) => task.status === "open" && task.dueAt !== null && within(start, end, parseInstant(task.dueAt)))
    .sort((left, right) => parseInstant(left.dueAt ?? "") - parseInstant(right.dueAt ?? "") || left.id.localeCompare(right.id))
    .map((task) => {
      addCitation(task.sourceFactId);
      return {
        id: task.id,
        title: task.title,
        startsAt: task.dueAt,
        endsAt: null,
        localTime: task.dueAt ? formatPlanningLocalDateTime(task.dueAt, input.window.timeZone) : null,
        status: task.status,
        sourceFactId: task.sourceFactId,
      };
    });
  const followUpItems = input.followUps
    .filter((followUp) => followUp.status !== "completed" && followUp.dueAt !== null && within(start, end, parseInstant(followUp.dueAt)))
    .sort((left, right) => parseInstant(left.dueAt ?? "") - parseInstant(right.dueAt ?? "") || left.id.localeCompare(right.id))
    .map((followUp) => {
      for (const sourceFactId of followUp.sourceFactIds) addCitation(sourceFactId);
      return {
        id: followUp.id,
        title: followUp.title,
        startsAt: followUp.dueAt,
        endsAt: null,
        localTime: followUp.dueAt ? formatPlanningLocalDateTime(followUp.dueAt, input.window.timeZone) : null,
        status: followUp.status,
        sourceFactId: followUp.sourceFactIds[0] ?? `follow-up:${followUp.id}`,
      };
    });

  return Object.freeze({
    briefingId: input.briefingId,
    window: input.window,
    sections: [
      { kind: "calendar" as const, title: "Calendar", items: calendarItems },
      { kind: "tasks" as const, title: "Tasks", items: taskItems },
      { kind: "follow_ups" as const, title: "Follow-ups", items: followUpItems },
    ],
    citations,
    automation: { mode: "template" as const, aiEnabled: false as const },
    calendarWrite: { authority: "approval-required" as const, canConfirm: false as const },
  });
}

/** Parses a briefing timestamp into a finite UTC epoch value. */
function parseInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Briefing timestamp is invalid.");
  return parsed;
}

/** Tests whether one due instant belongs to the half-open briefing window. */
function within(start: number, end: number, value: number): boolean {
  return value >= start && value < end;
}

/** Tests whether an event interval intersects the briefing window. */
function overlaps(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}
