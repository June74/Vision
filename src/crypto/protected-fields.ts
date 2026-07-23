/** Encrypts and decrypts protected object fields under exact graph context. */
import { DomainSchema, type Domain } from "../domain/categorization/category";
import {
  decryptText,
  encryptText,
  validateCipherEnvelope,
  type CipherEnvelope,
} from "./envelope";
import type { KeyProvider, VersionedDataKey } from "./key-provider";

/** Owner, node, and domain context required at the protected persistence boundary. */
export interface ProtectedObjectContext {
  readonly ownerId: string;
  readonly nodeId: string;
  readonly domain: Domain;
}

/** Plaintext values accepted by the protected-field boundary. */
export type PlainProtectedFields = Readonly<Record<string, string | null>>;

/** Encrypted form preserving the source object's field names and nullable values. */
export type EncryptedProtectedFields<T extends PlainProtectedFields> = {
  readonly [K in keyof T]: CipherEnvelope | null;
};

/** Encrypts every non-null string field using the provider's active data-key version. */
export async function encryptProtectedFields<T extends PlainProtectedFields>(
  keyProvider: KeyProvider,
  context: ProtectedObjectContext,
  fields: T,
): Promise<EncryptedProtectedFields<T>> {
  validateProtectedObjectContext(context);
  const entries = validatePlainProtectedFields(fields);
  const hasPlaintext = entries.some(([, value]) => value !== null);
  const activeKey = hasPlaintext ? await keyProvider.getDataKey(context.ownerId, context.domain) : undefined;

  const encryptedEntries = await Promise.all(
    entries.map(async ([fieldName, value]) => {
      if (value === null) {
        return [fieldName, null] as const;
      }

      const dataKey = activeKey as VersionedDataKey;
      return [
        fieldName,
        await encryptText(dataKey.key, value, {
          ownerId: context.ownerId,
          nodeId: context.nodeId,
          domain: context.domain,
          fieldName,
          keyVersion: dataKey.keyVersion,
        }),
      ] as const;
    }),
  );

  return Object.fromEntries(encryptedEntries) as EncryptedProtectedFields<T>;
}

/** Decrypts protected fields by resolving each envelope's exact historical data-key version. */
export async function decryptProtectedFields<T extends PlainProtectedFields>(
  keyProvider: KeyProvider,
  context: ProtectedObjectContext,
  fields: EncryptedProtectedFields<T>,
): Promise<T> {
  validateProtectedObjectContext(context);
  const entries = Object.entries(fields);
  const keyCache = new Map<number, Promise<VersionedDataKey>>();

  const plaintextEntries = await Promise.all(
    entries.map(async ([fieldName, value]) => {
      validateFieldName(fieldName);
      if (value === null) {
        return [fieldName, null] as const;
      }

      const envelope = validateCipherEnvelope(value);
      let dataKey = keyCache.get(envelope.keyVersion);
      if (!dataKey) {
        // Supplying a version is a read-only historical lookup; providers must never create a missing key here.
        dataKey = keyProvider.getDataKey(context.ownerId, context.domain, envelope.keyVersion);
        keyCache.set(envelope.keyVersion, dataKey);
      }

      const resolvedKey = await dataKey;
      return [
        fieldName,
        await decryptText(resolvedKey.key, envelope, {
          ownerId: context.ownerId,
          nodeId: context.nodeId,
          domain: context.domain,
          fieldName,
          keyVersion: envelope.keyVersion,
        }),
      ] as const;
    }),
  );

  return Object.fromEntries(plaintextEntries) as T;
}

/** Validates the complete graph context before any key lookup or cryptographic operation. */
function validateProtectedObjectContext(context: ProtectedObjectContext): void {
  if (
    typeof context !== "object" ||
    context === null ||
    typeof context.ownerId !== "string" ||
    context.ownerId.length === 0 ||
    typeof context.nodeId !== "string" ||
    context.nodeId.length === 0
  ) {
    throw new Error("Protected object context requires non-empty owner and node IDs.");
  }

  DomainSchema.parse(context.domain);
}

/** Validates plaintext object values without coercing or serializing non-string content. */
function validatePlainProtectedFields(fields: PlainProtectedFields): Array<[string, string | null]> {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    throw new Error("Protected fields must be an object.");
  }

  return Object.entries(fields).map(([fieldName, value]) => {
    validateFieldName(fieldName);
    if (typeof value !== "string" && value !== null) {
      throw new Error("Protected field values must be strings or null.");
    }

    return [fieldName, value];
  });
}

/** Validates a field identifier before using it as authenticated metadata. */
function validateFieldName(fieldName: string): void {
  if (fieldName.length === 0) {
    throw new Error("Protected field names must be non-empty.");
  }
}
