/** Implements strict AES-256-GCM envelopes for Vision protected fields. */
import { DomainSchema, type Domain } from "../domain/categorization/category";

/** Supported protected-field envelope formats: legacy v1 and domain-bound v2. */
export interface CipherEnvelope {
  readonly version: 1 | 2;
  readonly algorithm: "A256GCM";
  readonly keyVersion: number;
  readonly iv: string;
  readonly ciphertext: string;
}

/** Context cryptographically bound to one protected field. */
export interface ProtectedFieldAad {
  readonly ownerId: string;
  readonly nodeId: string;
  readonly domain: Domain;
  readonly fieldName: string;
  readonly keyVersion: number;
}

const ENVELOPE_KEYS = ["algorithm", "ciphertext", "iv", "keyVersion", "version"] as const;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const AES_GCM_IV_BASE64URL_CHARS = 16;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Maximum UTF-8 bytes allowed in one protected field. */
export const MAX_PROTECTED_PLAINTEXT_BYTES = 64 * 1024;

/** Maximum unpadded base64url characters allowed in one protected-field ciphertext. */
export const MAX_CIPHERTEXT_BASE64URL_CHARS = getBase64UrlEncodedLength(
  MAX_PROTECTED_PLAINTEXT_BYTES + AES_GCM_TAG_BYTES,
);

/** Maximum JSON characters accepted before parsing a serialized protected-field envelope. */
export const MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS = MAX_CIPHERTEXT_BASE64URL_CHARS + 512;

/** Encodes binary data as canonical unpadded base64url at an envelope boundary. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Decodes bounded canonical unpadded base64url and rejects ambiguous encodings before allocation. */
export function decodeBase64Url(
  value: unknown,
  label = "binary value",
  maximumEncodedLength = MAX_CIPHERTEXT_BASE64URL_CHARS,
): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error(`${label} must be canonical unpadded base64url.`);
  }

  if (value.length > maximumEncodedLength) {
    throw new Error(`${label} exceeds the allowed encoded size.`);
  }

  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const decoded = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      decoded[index] = binary.charCodeAt(index);
    }

    if (encodeBase64Url(decoded) !== value) {
      throw new Error("Non-canonical base64url.");
    }

    return decoded;
  } catch {
    throw new Error(`${label} must be canonical unpadded base64url.`);
  }
}

/** Validates a positive integer key version before it enters authenticated metadata. */
export function validateKeyVersion(keyVersion: unknown): number {
  if (!Number.isSafeInteger(keyVersion) || (keyVersion as number) <= 0) {
    throw new Error("Key version must be a positive safe integer.");
  }

  return keyVersion as number;
}

/** Strictly validates a JSON-shaped cipher envelope and its binary boundaries. */
export function validateCipherEnvelope(value: unknown): CipherEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Cipher envelope must be an object.");
  }

  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== [...ENVELOPE_KEYS].sort().join(",")
  ) {
    throw new Error("Cipher envelope contains missing or unknown fields.");
  }

  if (record.version !== 1 && record.version !== 2) {
    throw new Error("Unsupported cipher envelope version.");
  }

  if (record.algorithm !== "A256GCM") {
    throw new Error("Unsupported cipher envelope algorithm.");
  }

  const keyVersion = validateKeyVersion(record.keyVersion);
  if (typeof record.iv !== "string" || record.iv.length !== AES_GCM_IV_BASE64URL_CHARS) {
    throw new Error("Cipher envelope IV must be 96 bits.");
  }

  if (
    typeof record.ciphertext !== "string" ||
    record.ciphertext.length < getBase64UrlEncodedLength(AES_GCM_TAG_BYTES)
  ) {
    throw new Error("Cipher envelope ciphertext must include a 128-bit authentication tag.");
  }

  if (record.ciphertext.length > MAX_CIPHERTEXT_BASE64URL_CHARS) {
    throw new Error("Cipher envelope ciphertext exceeds the allowed size.");
  }

  // Exact and maximum encoded lengths are admitted before atob can allocate decoded copies.
  const iv = decodeBase64Url(record.iv, "Cipher envelope IV", AES_GCM_IV_BASE64URL_CHARS);
  const ciphertext = decodeBase64Url(
    record.ciphertext,
    "Cipher envelope ciphertext",
    MAX_CIPHERTEXT_BASE64URL_CHARS,
  );
  if (iv.byteLength !== AES_GCM_IV_BYTES) {
    throw new Error("Cipher envelope IV must be 96 bits.");
  }

  if (ciphertext.byteLength < AES_GCM_TAG_BYTES) {
    throw new Error("Cipher envelope ciphertext must include a 128-bit authentication tag.");
  }

  return {
    version: record.version,
    algorithm: "A256GCM",
    keyVersion,
    iv: record.iv as string,
    ciphertext: record.ciphertext as string,
  };
}

/** Serializes a validated envelope for a JSON persistence or message boundary. */
export function serializeCipherEnvelope(envelope: CipherEnvelope): string {
  const serialized = JSON.stringify(validateCipherEnvelope(envelope));
  if (serialized.length > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS) {
    throw new Error("Serialized cipher envelope exceeds the allowed size.");
  }

  return serialized;
}

/** Parses and strictly validates an envelope received from a JSON boundary. */
export function parseCipherEnvelope(serialized: string): CipherEnvelope {
  if (typeof serialized !== "string") {
    throw new Error("Serialized cipher envelope must be a string.");
  }

  if (serialized.length > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS) {
    throw new Error("Serialized cipher envelope exceeds the allowed size.");
  }

  try {
    return validateCipherEnvelope(JSON.parse(serialized) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Serialized cipher envelope must be valid JSON.");
    }

    throw error;
  }
}

/** Encrypts UTF-8 text with fresh AES-GCM randomness and field-specific authenticated metadata. */
export async function encryptText(
  key: CryptoKey,
  plaintext: string,
  aad: ProtectedFieldAad,
): Promise<CipherEnvelope> {
  validateAes256GcmKey(key, "encrypt");
  validateProtectedFieldAad(aad);
  if (typeof plaintext !== "string" || plaintext.length > MAX_PROTECTED_PLAINTEXT_BYTES) {
    throw new Error("Protected plaintext exceeds the allowed size.");
  }

  const plaintextBytes = textEncoder.encode(plaintext);
  if (plaintextBytes.byteLength > MAX_PROTECTED_PLAINTEXT_BYTES) {
    throw new Error("Protected plaintext exceeds the allowed UTF-8 size.");
  }

  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  // Reusing an IV with the same AES-GCM key is catastrophic, so every call owns a newly generated 96-bit IV.
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encodeProtectedFieldAad(aad, 2),
      tagLength: 128,
    },
    key,
    plaintextBytes,
  );

  return {
    version: 2,
    algorithm: "A256GCM",
    keyVersion: aad.keyVersion,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  };
}

/** Authenticates and decrypts a protected UTF-8 value under its exact field context. */
export async function decryptText(
  key: CryptoKey,
  envelope: CipherEnvelope,
  aad: ProtectedFieldAad,
): Promise<string> {
  validateAes256GcmKey(key, "decrypt");
  validateProtectedFieldAad(aad);
  const validatedEnvelope = validateCipherEnvelope(envelope);

  if (validatedEnvelope.keyVersion !== aad.keyVersion) {
    throw new Error("Cipher envelope key version does not match authenticated metadata.");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(validatedEnvelope.iv, "Cipher envelope IV", AES_GCM_IV_BASE64URL_CHARS),
      additionalData: encodeProtectedFieldAad(aad, validatedEnvelope.version),
      tagLength: 128,
    },
    key,
    decodeBase64Url(
      validatedEnvelope.ciphertext,
      "Cipher envelope ciphertext",
      MAX_CIPHERTEXT_BASE64URL_CHARS,
    ),
  );

  return textDecoder.decode(plaintext);
}

/** Validates non-empty owner, node, and field identifiers used as protected-field AAD. */
function validateProtectedFieldAad(aad: ProtectedFieldAad): void {
  if (
    typeof aad !== "object" ||
    aad === null ||
    typeof aad.ownerId !== "string" ||
    aad.ownerId.length === 0 ||
    typeof aad.nodeId !== "string" ||
    aad.nodeId.length === 0 ||
    typeof aad.fieldName !== "string" ||
    aad.fieldName.length === 0
  ) {
    throw new Error("Protected-field authenticated metadata requires non-empty owner, node, and field identifiers.");
  }

  DomainSchema.parse(aad.domain);
  validateKeyVersion(aad.keyVersion);
}

/** Creates an unambiguous versioned byte representation of protected-field AAD. */
function encodeProtectedFieldAad(
  aad: ProtectedFieldAad,
  envelopeVersion: CipherEnvelope["version"],
): Uint8Array<ArrayBuffer> {
  // A fixed-purpose JSON tuple prevents concatenation collisions and makes every binding position unambiguous.
  return textEncoder.encode(
    JSON.stringify(
      envelopeVersion === 1
        ? [
            "vision-protected-field",
            1,
            aad.ownerId,
            aad.nodeId,
            aad.fieldName,
            aad.keyVersion,
          ]
        : [
            "vision-protected-field",
            2,
            aad.ownerId,
            aad.nodeId,
            aad.domain,
            aad.fieldName,
            aad.keyVersion,
          ],
    ),
  );
}

/** Ensures callers cannot accidentally use a weak, extractable, or wrong-purpose key. */
function validateAes256GcmKey(key: CryptoKey, usage: "encrypt" | "decrypt"): void {
  const algorithm = key.algorithm as AesKeyAlgorithm;
  if (
    key.type !== "secret" ||
    key.extractable ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !key.usages.includes(usage)
  ) {
    throw new Error(`Protected fields require a non-extractable 256-bit AES-GCM key with ${usage} permission.`);
  }
}

/** Returns the exact canonical unpadded base64url length for a byte count. */
function getBase64UrlEncodedLength(byteLength: number): number {
  const completeGroups = Math.floor(byteLength / 3);
  const remainder = byteLength % 3;
  return completeGroups * 4 + (remainder === 0 ? 0 : remainder + 1);
}
