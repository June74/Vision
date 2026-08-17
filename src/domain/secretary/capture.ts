/** Defines deterministic local capture classification without invoking an AI or calendar write. */

export type SecretaryCaptureKind = "task" | "note" | "calendar_candidate" | "ambiguous";
export type SecretaryCaptureAmbiguity = "none" | "needs_clarification";

/** The only calendar authority a capture may produce: a pending proposal marker. */
export interface SecretaryCalendarProposalMarker {
  readonly action: "create";
  readonly status: "pending_approval";
  readonly requiresExplicitApproval: true;
  readonly canConfirm: false;
}

/** Classification returned to the owner after one local capture is stored. */
export interface SecretaryCaptureClassification {
  readonly content: string;
  readonly title: string | null;
  readonly kind: SecretaryCaptureKind;
  readonly ambiguity: SecretaryCaptureAmbiguity;
  readonly calendarProposal: SecretaryCalendarProposalMarker | null;
}

/** Persisted/displayable local capture with an opaque owner-scoped identity. */
export interface SecretaryCapture extends SecretaryCaptureClassification {
  readonly id: string;
  readonly createdAt: string;
}

/** Classifies a bounded capture by explicit prefix and leaves unprefixed text unresolved. */
export function classifyCapture(input: unknown): SecretaryCaptureClassification {
  if (typeof input !== "string") throw new Error("Capture input is invalid.");
  const content = input.trim();
  if (content.length === 0 || content.length > 8_192 || /[\u0000-\u001f\u007f]/u.test(content)) {
    throw new Error("Capture input is invalid.");
  }

  const prefixed = /^(task|note|calendar)\s*:\s*(.+)$/iu.exec(content);
  if (!prefixed?.[1] || !prefixed[2]) {
    return {
      content,
      title: null,
      kind: "ambiguous",
      ambiguity: "needs_clarification",
      calendarProposal: null,
    };
  }

  const prefix = prefixed[1].toLowerCase();
  const title = prefixed[2].trim();
  if (title.length === 0) throw new Error("Capture input is invalid.");
  if (prefix === "calendar") {
    return {
      content,
      title,
      kind: "calendar_candidate",
      ambiguity: "none",
      calendarProposal: {
        action: "create",
        status: "pending_approval",
        requiresExplicitApproval: true,
        canConfirm: false,
      },
    };
  }

  return {
    content,
    title,
    kind: prefix === "task" ? "task" : "note",
    ambiguity: "none",
    calendarProposal: null,
  };
}

/** Creates one timestamped capture after classification and identity validation. */
export function createSecretaryCapture(input: {
  readonly id: string;
  readonly content: unknown;
  readonly createdAt: Date;
}): SecretaryCapture {
  assertIdentity(input.id);
  assertDate(input.createdAt, "Capture timestamp is invalid.");
  return {
    id: input.id,
    ...classifyCapture(input.content),
    createdAt: input.createdAt.toISOString(),
  };
}

/** Keeps local opaque IDs bounded before they enter protected-data context or SQL. */
function assertIdentity(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) {
    throw new Error("Capture input is invalid.");
  }
}

/** Rejects invalid Date objects without accepting caller string coercion. */
function assertDate(value: unknown, message: string): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error(message);
}
