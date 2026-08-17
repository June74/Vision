/** Defines explicit local task creation and reversible completion transitions. */

export type SecretaryTaskStatus = "open" | "completed";

/** Owner-scoped local task with queryable scheduling metadata and protected title content. */
export interface SecretaryTask {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly status: SecretaryTaskStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

/** Creates an open task with exact offset-bearing due time and IANA timezone metadata. */
export function createSecretaryTask(input: {
  readonly id: string;
  readonly title: unknown;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly createdAt: Date;
}): SecretaryTask {
  assertIdentity(input.id);
  const title = readText(input.title, 1_024);
  assertDate(input.createdAt);
  assertTimeZone(input.timeZone);
  if (input.dueAt !== null) assertIsoDate(input.dueAt);
  return {
    id: input.id,
    title,
    dueAt: input.dueAt,
    timeZone: input.timeZone,
    status: "open",
    createdAt: input.createdAt.toISOString(),
    completedAt: null,
  };
}

/** Applies one explicit completion or undo transition and rejects duplicate actions. */
export function transitionSecretaryTask(
  task: SecretaryTask,
  action: "complete" | "undo",
  at: Date,
): SecretaryTask {
  assertDate(at);
  if (action === "complete" && task.status === "open") {
    return { ...task, status: "completed", completedAt: at.toISOString() };
  }
  if (action === "undo" && task.status === "completed") {
    return { ...task, status: "open", completedAt: null };
  }
  throw new Error("Task transition is invalid.");
}

/** Accepts bounded opaque task identities. */
function assertIdentity(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error("Task input is invalid.");
  }
}

/** Accepts one nonempty bounded protected title without coercion. */
function readText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("Task input is invalid.");
  const text = value.trim();
  if (text.length === 0 || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) {
    throw new Error("Task input is invalid.");
  }
  return text;
}

/** Rejects invalid Date objects. */
function assertDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("Task input is invalid.");
}

/** Accepts only an explicit offset-bearing ISO timestamp. */
function assertIsoDate(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:?\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("Task input is invalid.");
  }
}

/** Rejects unknown IANA zones instead of falling back to the server zone. */
export function assertTimeZone(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255) {
    throw new Error("Task input is invalid.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new Error("Task input is invalid.");
  }
}
