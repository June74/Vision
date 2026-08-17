/** Defines bounded local notes whose title and body are encrypted by the repository. */

/** Owner-scoped protected note record. */
export interface SecretaryNote {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: "active";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Creates an active note without connecting it to a provider or calendar operation. */
export function createSecretaryNote(input: {
  readonly id: string;
  readonly title: unknown;
  readonly body: unknown;
  readonly createdAt: Date;
}): SecretaryNote {
  assertIdentity(input.id);
  const title = readText(input.title, 512);
  const body = readText(input.body, 16 * 1_024);
  if (!(input.createdAt instanceof Date) || !Number.isFinite(input.createdAt.getTime())) {
    throw new Error("Note input is invalid.");
  }
  const timestamp = input.createdAt.toISOString();
  return { id: input.id, title, body, status: "active", createdAt: timestamp, updatedAt: timestamp };
}

/** Accepts one bounded opaque note identity. */
function assertIdentity(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error("Note input is invalid.");
  }
}

/** Accepts one nonempty protected text field without coercion. */
function readText(value: unknown, maximum: number): string {
  if (typeof value !== "string") throw new Error("Note input is invalid.");
  const text = value.trim();
  if (text.length === 0 || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) {
    throw new Error("Note input is invalid.");
  }
  return text;
}
