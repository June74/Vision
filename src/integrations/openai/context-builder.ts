/** Builds a bounded category packet by copying only explicitly permitted event facts. */

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u;
const RFC3339_WITH_OFFSET_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const IANA_TIME_ZONE_PATTERN = /^(?:UTC|[A-Za-z_+-]+\/[A-Za-z0-9_+./-]+)$/u;
const TITLE_TOKEN_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._'-]*$/u;
const FACT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.:/+@-]*$/u;

/** Identifies a fail-closed minimum-context validation error without retaining input details. */
export class CategoryContextError extends Error {
  readonly code = "AI_CONTEXT_INVALID";

  constructor() {
    super("Category context is invalid.");
    this.name = "CategoryContextError";
  }
}

/** Represents the caller's explicit title disclosure decision. */
export type CategoryTitlePermission =
  | { readonly mode: "omit" }
  | { readonly mode: "plaintext" }
  | { readonly mode: "tokens"; readonly tokens: readonly string[] };

/** Represents one bounded, caller-approved evidence fact. */
export interface PermittedCategoryEvidence {
  readonly id: string;
  readonly fact: string;
}

/** Supplies the complete disclosure policy used for one category packet. */
export interface CategoryContextPermissions {
  readonly policyVersion: string;
  readonly title: CategoryTitlePermission;
  readonly evidence: readonly PermittedCategoryEvidence[];
}

/** Contains normalized schedule facts safe for category inference. */
export interface CategoryScheduleContext {
  readonly start: string;
  readonly end: string;
  readonly allDay: boolean;
  readonly timeZone: string;
}

/** Contains only the bounded, policy-permitted facts sent to an AI provider. */
export interface CategoryContextPacket {
  readonly eventId: string;
  readonly title?:
    | { readonly mode: "plaintext"; readonly value: string }
    | { readonly mode: "tokens"; readonly tokens: readonly string[] };
  readonly schedule: CategoryScheduleContext;
  readonly sourceAssociation?: string;
  readonly evidence: readonly PermittedCategoryEvidence[];
  readonly policyVersion: string;
}

/** Reads an enumerable own data property without invoking accessors or proxy-backed traps. */
function readOwnDataProperty(record: object, property: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, property);
  } catch {
    throw new CategoryContextError();
  }

  if (
    descriptor === undefined ||
    !descriptor.enumerable ||
    "get" in descriptor ||
    "set" in descriptor
  ) {
    throw new CategoryContextError();
  }
  return descriptor.value;
}

/** Reads an optional enumerable own data property without invoking accessors. */
function readOptionalOwnDataProperty(record: object, property: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, property);
  } catch {
    throw new CategoryContextError();
  }
  if (descriptor === undefined) {
    return undefined;
  }
  if (!descriptor.enumerable || "get" in descriptor || "set" in descriptor) {
    throw new CategoryContextError();
  }
  return descriptor.value;
}

/** Requires a non-array plain record before any named properties are read. */
function requirePlainRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CategoryContextError();
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CategoryContextError();
    }
  } catch {
    throw new CategoryContextError();
  }
  return value as Record<string, unknown>;
}

/** Copies a bounded plain array through data descriptors without invoking element getters. */
function readPlainArrayData(value: unknown, maximumLength: number): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new CategoryContextError();
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype && prototype !== null) {
      throw new CategoryContextError();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const lengthDescriptor = descriptors.length;
    if (
      Object.getOwnPropertySymbols(value).length > 0 ||
      lengthDescriptor === undefined ||
      "get" in lengthDescriptor ||
      typeof lengthDescriptor.value !== "number" ||
      lengthDescriptor.value < 1 ||
      lengthDescriptor.value > maximumLength ||
      Object.keys(descriptors).some(
        (key) => key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key),
      )
    ) {
      throw new CategoryContextError();
    }

    const result: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        "get" in descriptor ||
        "set" in descriptor
      ) {
        throw new CategoryContextError();
      }
      result.push(descriptor.value);
    }
    return result;
  } catch {
    throw new CategoryContextError();
  }
}

/** Validates a bounded opaque identifier without reflecting its value into errors. */
function requireIdentifier(value: unknown, maximumLength = 128): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    throw new CategoryContextError();
  }
  return value;
}

/** Copies the explicitly allowed title representation and otherwise reads no title data. */
function buildTitle(
  event: Record<string, unknown>,
  permission: unknown,
): CategoryContextPacket["title"] {
  const titlePermission = requirePlainRecord(permission);
  const mode = readOwnDataProperty(titlePermission, "mode");

  if (mode === "omit") {
    return undefined;
  }
  if (mode === "plaintext") {
    const value = readOwnDataProperty(event, "title");
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 256 ||
      /[\u0000-\u001f\u007f]/u.test(value)
    ) {
      throw new CategoryContextError();
    }
    return { mode, value };
  }
  if (mode === "tokens") {
    const tokens = readPlainArrayData(
      readOwnDataProperty(titlePermission, "tokens"),
      16,
    );
    if (
      tokens.some(
        (token) =>
          typeof token !== "string" ||
          token.length < 1 ||
          token.length > 48 ||
          !TITLE_TOKEN_PATTERN.test(token),
      ) ||
      new Set(tokens).size !== tokens.length
    ) {
      throw new CategoryContextError();
    }
    return { mode, tokens: [...tokens] as string[] };
  }
  throw new CategoryContextError();
}

/** Copies and validates bounded evidence facts through data descriptors only. */
function buildEvidence(value: unknown): readonly PermittedCategoryEvidence[] {
  const evidence = readPlainArrayData(value, 16).map((candidate) => {
    const record = requirePlainRecord(candidate);
    const id = requireIdentifier(readOwnDataProperty(record, "id"));
    const fact = readOwnDataProperty(record, "fact");
    if (
      typeof fact !== "string" ||
      fact.length < 1 ||
      fact.length > 256 ||
      !FACT_PATTERN.test(fact)
    ) {
      throw new CategoryContextError();
    }
    return { id, fact };
  });

  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length) {
    throw new CategoryContextError();
  }
  return evidence;
}

/** Builds one minimum-context category packet from untrusted event data and trusted permissions. */
export function buildCategoryContext(
  event: unknown,
  permittedEvidence: unknown,
): CategoryContextPacket {
  const eventRecord = requirePlainRecord(event);
  const permissions = requirePlainRecord(permittedEvidence);
  const eventId = requireIdentifier(readOwnDataProperty(eventRecord, "eventId"));
  const policyVersionValue = readOwnDataProperty(permissions, "policyVersion");
  const policyVersion =
    typeof policyVersionValue === "string" &&
    policyVersionValue.length <= 64 &&
    POLICY_VERSION_PATTERN.test(policyVersionValue)
      ? policyVersionValue
      : undefined;
  if (policyVersion === undefined) {
    throw new CategoryContextError();
  }

  const start = readOwnDataProperty(eventRecord, "start");
  const end = readOwnDataProperty(eventRecord, "end");
  const allDay = readOwnDataProperty(eventRecord, "allDay");
  const timeZone = readOwnDataProperty(eventRecord, "timeZone");
  if (
    typeof start !== "string" ||
    !RFC3339_WITH_OFFSET_PATTERN.test(start) ||
    !Number.isFinite(Date.parse(start)) ||
    typeof end !== "string" ||
    !RFC3339_WITH_OFFSET_PATTERN.test(end) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start) ||
    typeof allDay !== "boolean" ||
    typeof timeZone !== "string" ||
    timeZone.length > 255 ||
    !IANA_TIME_ZONE_PATTERN.test(timeZone)
  ) {
    throw new CategoryContextError();
  }

  const sourceValue = readOptionalOwnDataProperty(eventRecord, "sourceAssociation");
  const sourceAssociation =
    sourceValue === undefined ? undefined : requireIdentifier(sourceValue);
  const title = buildTitle(eventRecord, readOwnDataProperty(permissions, "title"));
  const evidence = buildEvidence(readOwnDataProperty(permissions, "evidence"));

  return {
    eventId,
    ...(title === undefined ? {} : { title }),
    schedule: { start, end, allDay, timeZone },
    ...(sourceAssociation === undefined ? {} : { sourceAssociation }),
    evidence,
    policyVersion,
  };
}
