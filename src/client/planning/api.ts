/** Defines the browser-safe deterministic planning API and local follow-up lifecycle calls. */
import type { BrowserSession } from "../setup/api";

export interface PlanningCitation {
  readonly sourceFactId: string;
  readonly kind: string;
  readonly label: string;
}

export interface SchedulingAlternative {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly localStart: string;
  readonly localEnd: string;
  readonly timeZone: string;
  readonly citations: readonly PlanningCitation[];
}

export interface SchedulingProposal {
  readonly proposalId: string;
  readonly title: string;
  readonly durationMinutes: number;
  readonly status: "ready" | "conflict" | "needs_clarification";
  readonly ambiguity: readonly string[];
  readonly alternatives: readonly SchedulingAlternative[];
  readonly conflicts: readonly { readonly blockId: string; readonly sourceFactId: string; readonly citation: PlanningCitation }[];
  readonly citations: readonly PlanningCitation[];
  readonly automation: { readonly mode: "deterministic"; readonly aiEnabled: false };
  readonly calendarWrite: { readonly authority: "approval-required"; readonly canConfirm: false; readonly approvalOperationId: string | null };
}

export interface Briefing {
  readonly briefingId: string;
  readonly window: { readonly kind: string; readonly startsAt: string; readonly endsAt: string; readonly timeZone: string };
  readonly sections: readonly { readonly kind: string; readonly title: string; readonly items: readonly { readonly id: string; readonly title: string; readonly localTime: string | null; readonly status: string; readonly sourceFactId: string }[] }[];
  readonly citations: readonly PlanningCitation[];
  readonly automation: { readonly mode: "template"; readonly aiEnabled: false };
  readonly calendarWrite: { readonly authority: "approval-required"; readonly canConfirm: false };
}

export interface FollowUp {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly sourceFactIds: readonly string[];
  readonly status: "open" | "snoozed" | "completed";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly snoozedUntil: string | null;
  readonly completedAt: string | null;
}

/** Reads one template-backed briefing without sending protected content to an AI provider. */
export async function readPlanningBriefing(timeZone: string, window = "morning"): Promise<Briefing> {
  const response = await fetch(`/api/planning/briefing?timeZone=${encodeURIComponent(timeZone)}&window=${encodeURIComponent(window)}`, { credentials: "same-origin" });
  return readPayload(response, parseBriefingEnvelope);
}

/** Requests one deterministic conflict-aware scheduling proposal. */
export async function createSchedulingProposal(
  session: BrowserSession,
  input: {
    readonly title: string;
    readonly durationMinutes: number;
    readonly preferredStartAt: string | null;
    readonly window: { readonly startsAt: string; readonly endsAt: string; readonly timeZone: string };
    readonly ambiguity: readonly string[];
  },
): Promise<SchedulingProposal> {
  const response = await fetch("/api/planning/proposals", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseProposalEnvelope);
}

/** Reads current owner-scoped follow-ups. */
export async function readPlanningFollowUps(timeZone: string): Promise<readonly FollowUp[]> {
  const response = await fetch(`/api/planning/follow-ups?timeZone=${encodeURIComponent(timeZone)}`, { credentials: "same-origin" });
  return readPayload(response, parseFollowUpsEnvelope);
}

/** Creates one local follow-up from an authenticated owner session. */
export async function createPlanningFollowUp(
  session: BrowserSession,
  input: { readonly title: string; readonly dueAt: string | null; readonly timeZone: string; readonly sourceFactIds: readonly string[] },
): Promise<FollowUp> {
  const response = await fetch("/api/planning/follow-ups", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseFollowUpEnvelope);
}

/** Completes, reopens, or snoozes one local follow-up without creating a calendar operation. */
export async function transitionPlanningFollowUp(
  session: BrowserSession,
  id: string,
  action: "complete" | "reopen" | "snooze",
  snoozedUntil?: string,
): Promise<FollowUp> {
  const response = await fetch(`/api/planning/follow-ups/${encodeURIComponent(id)}/${action}`, {
    body: JSON.stringify(snoozedUntil ? { snoozedUntil } : {}),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseFollowUpEnvelope);
}

/** Rejects non-success responses and delegates JSON to one allowlist parser. */
async function readPayload<T>(response: Response, parser: (value: unknown) => T): Promise<T> {
  if (!response.ok) throw new Error("Planning request was not accepted.");
  return parser(await response.json().catch(() => undefined));
}

/** Parses the template briefing envelope and enforces its no-AI/no-write markers. */
function parseBriefingEnvelope(value: unknown): Briefing {
  const briefing = isRecord(value) && isRecord(value.briefing) ? value.briefing : undefined;
  if (!briefing || !isRecord(briefing.window) || !isArray(briefing.sections) || !isArray(briefing.citations) || !isRecord(briefing.automation) || !isRecord(briefing.calendarWrite)) throw new Error("Invalid briefing response.");
  if (briefing.automation.mode !== "template" || briefing.automation.aiEnabled !== false || briefing.calendarWrite.authority !== "approval-required" || briefing.calendarWrite.canConfirm !== false) throw new Error("Invalid briefing response.");
  return {
    briefingId: readString(briefing.briefingId),
    window: { kind: readString(briefing.window.kind), startsAt: readString(briefing.window.startsAt), endsAt: readString(briefing.window.endsAt), timeZone: readString(briefing.window.timeZone) },
    sections: briefing.sections.map(parseSection),
    citations: briefing.citations.map(parseCitation),
    automation: { mode: "template", aiEnabled: false },
    calendarWrite: { authority: "approval-required", canConfirm: false },
  };
}

/** Parses one conflict-aware proposal envelope without accepting authority-bearing extras. */
function parseProposalEnvelope(value: unknown): SchedulingProposal {
  const proposal = isRecord(value) && isRecord(value.proposal) ? value.proposal : undefined;
  if (!proposal || !isArray(proposal.alternatives) || !isArray(proposal.conflicts) || !isArray(proposal.ambiguity) || !isArray(proposal.citations) || !isRecord(proposal.automation) || !isRecord(proposal.calendarWrite)) throw new Error("Invalid proposal response.");
  if (proposal.automation.mode !== "deterministic" || proposal.automation.aiEnabled !== false || proposal.calendarWrite.authority !== "approval-required" || proposal.calendarWrite.canConfirm !== false || (proposal.calendarWrite.approvalOperationId !== null && typeof proposal.calendarWrite.approvalOperationId !== "string")) throw new Error("Invalid proposal response.");
  return {
    proposalId: readString(proposal.proposalId),
    title: readString(proposal.title),
    durationMinutes: readNumber(proposal.durationMinutes),
    status: readEnum(proposal.status, ["ready", "conflict", "needs_clarification"] as const),
    ambiguity: proposal.ambiguity.map(readString),
    alternatives: proposal.alternatives.map(parseAlternative),
    conflicts: proposal.conflicts.map(parseConflict),
    citations: proposal.citations.map(parseCitation),
    automation: { mode: "deterministic", aiEnabled: false },
    calendarWrite: { authority: "approval-required", canConfirm: false, approvalOperationId: proposal.calendarWrite.approvalOperationId as string | null },
  };
}

/** Parses the owner follow-up list envelope. */
function parseFollowUpsEnvelope(value: unknown): readonly FollowUp[] {
  const followUps = isRecord(value) && isArray(value.followUps) ? value.followUps : undefined;
  if (!followUps) throw new Error("Invalid follow-up response.");
  return followUps.map(parseFollowUp);
}

/** Parses one created or transitioned follow-up envelope. */
function parseFollowUpEnvelope(value: unknown): FollowUp {
  const followUp = isRecord(value) && isRecord(value.followUp) ? value.followUp : undefined;
  if (!followUp) throw new Error("Invalid follow-up response.");
  return parseFollowUp(followUp);
}

/** Validates one follow-up record and its lifecycle union. */
function parseFollowUp(value: unknown): FollowUp {
  if (!isRecord(value) || !isArray(value.sourceFactIds)) throw new Error("Invalid follow-up response.");
  return {
    id: readString(value.id),
    title: readString(value.title),
    dueAt: value.dueAt === null ? null : readString(value.dueAt),
    timeZone: readString(value.timeZone),
    sourceFactIds: value.sourceFactIds.map(readString),
    status: readEnum(value.status, ["open", "snoozed", "completed"] as const),
    createdAt: readString(value.createdAt),
    updatedAt: readString(value.updatedAt),
    snoozedUntil: value.snoozedUntil === null ? null : readString(value.snoozedUntil),
    completedAt: value.completedAt === null ? null : readString(value.completedAt),
  };
}

/** Parses one typed briefing section and its bounded item list. */
function parseSection(value: unknown): Briefing["sections"][number] {
  if (!isRecord(value) || !isArray(value.items)) throw new Error("Invalid briefing section.");
  return { kind: readString(value.kind), title: readString(value.title), items: value.items.map((item) => {
    if (!isRecord(item)) throw new Error("Invalid briefing item.");
    return { id: readString(item.id), title: readString(item.title), startsAt: item.startsAt === null ? null : readString(item.startsAt), endsAt: item.endsAt === null ? null : readString(item.endsAt), localTime: item.localTime === null ? null : readString(item.localTime), status: readString(item.status), sourceFactId: readString(item.sourceFactId) };
  }) };
}

/** Parses one person-facing scheduling alternative. */
function parseAlternative(value: unknown): SchedulingAlternative {
  if (!isRecord(value) || !isArray(value.citations)) throw new Error("Invalid scheduling alternative.");
  return { id: readString(value.id), startsAt: readString(value.startsAt), endsAt: readString(value.endsAt), localStart: readString(value.localStart), localEnd: readString(value.localEnd), timeZone: readString(value.timeZone), citations: value.citations.map(parseCitation) };
}

/** Parses one cited hard scheduling conflict. */
function parseConflict(value: unknown): SchedulingProposal["conflicts"][number] {
  if (!isRecord(value) || !isRecord(value.citation)) throw new Error("Invalid scheduling conflict.");
  return { blockId: readString(value.blockId), sourceFactId: readString(value.sourceFactId), citation: parseCitation(value.citation) };
}

/** Parses one source-fact citation. */
function parseCitation(value: unknown): PlanningCitation {
  if (!isRecord(value)) throw new Error("Invalid planning citation.");
  return { sourceFactId: readString(value.sourceFactId), kind: readString(value.kind), label: readString(value.label) };
}

/** Narrows an unknown JSON value to a non-array record. */
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
/** Narrows an unknown JSON value to an array. */
function isArray(value: unknown): value is unknown[] { return Array.isArray(value); }
/** Reads one required string from an untrusted response. */
function readString(value: unknown): string { if (typeof value !== "string") throw new Error("Invalid planning field."); return value; }
/** Reads one finite number from an untrusted response. */
function readNumber(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid planning field."); return value; }
/** Reads one member of a closed response union. */
function readEnum<T extends readonly string[]>(value: unknown, options: T): T[number] { if (typeof value !== "string" || !options.includes(value)) throw new Error("Invalid planning field."); return value as T[number]; }
