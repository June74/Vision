/** Implements strict AES-256-GCM envelopes for Vision protected fields. */

/** The only supported protected-field envelope format. */
export interface CipherEnvelope {
  readonly version: 1;
  readonly algorithm: "A256GCM";
  readonly keyVersion: number;
  readonly iv: string;
  readonly ciphertext: string;
}

/** Context cryptographically bound to one protected field. */
export interface ProtectedFieldAad {
  readonly ownerId: string;
  readonly nodeId: string;
  readonly fieldName: string;
  readonly keyVersion: number;
}

const ENVELOPE_KEYS = ["algorithm", "ciphertext", "iv", "keyVersion", "version"] as const;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Encodes binary data as canonical unpadded base64url at an envelope boundary. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Decodes only canonical unpadded base64url and rejects ambiguous encodings. */
export function decodeBase64Url(value: unknown, label = "binary value"): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    !BASE64URL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error(`${label} must be canonical unpadded base64url.`);
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

  if (record.version !== 1) {
    throw new Error("Unsupported cipher envelope version.");
  }

  if (record.algorithm !== "A256GCM") {
    throw new Error("Unsupported cipher envelope algorithm.");
  }

  const keyVersion = validateKeyVersion(record.keyVersion);
  const iv = decodeBase64Url(record.iv, "Cipher envelope IV");
  const ciphertext = decodeBase64Url(record.ciphertext, "Cipher envelope ciphertext");

  if (iv.byteLength !== 12) {
    throw new Error("Cipher envelope IV must be 96 bits.");
  }

  if (ciphertext.byteLength < 16) {
    throw new Error("Cipher envelope ciphertext must include a 128-bit authentication tag.");
  }

  return {
    version: 1,
    algorithm: "A256GCM",
    keyVersion,
    iv: record.iv as string,
    ciphertext: record.ciphertext as string,
  };
}

/** Serializes a validated envelope for a JSON persistence or message boundary. */
export function serializeCipherEnvelope(envelope: CipherEnvelope): string {
  return JSON.stringify(validateCipherEnvelope(envelope));
}

/** Parses and strictly validates an envelope received from a JSON boundary. */
export function parseCipherEnvelope(serialized: string): CipherEnvelope {
  if (typeof serialized !== "string") {
    throw new Error("Serialized cipher envelope must be a string.");
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

  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Reusing an IV with the same AES-GCM key is catastrophic, so every call owns a newly generated 96-bit IV.
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encodeProtectedFieldAad(aad),
      tagLength: 128,
    },
    key,
    textEncoder.encode(plaintext),
  );

  return {
    version: 1,
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
      iv: decodeBase64Url(validatedEnvelope.iv, "Cipher envelope IV"),
      additionalData: encodeProtectedFieldAad(aad),
      tagLength: 128,
    },
    key,
    decodeBase64Url(validatedEnvelope.ciphertext, "Cipher envelope ciphertext"),
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

  validateKeyVersion(aad.keyVersion);
}

/** Creates an unambiguous versioned byte representation of protected-field AAD. */
function encodeProtectedFieldAad(aad: ProtectedFieldAad): Uint8Array<ArrayBuffer> {
  // A fixed-purpose JSON tuple prevents concatenation collisions and makes every binding position unambiguous.
  return textEncoder.encode(
    JSON.stringify(["vision-protected-field", 1, aad.ownerId, aad.nodeId, aad.fieldName, aad.keyVersion]),
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
