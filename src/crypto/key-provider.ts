/** Provides wrapped per-owner, per-domain AES data keys with explicit rotation versions. */
import { DomainSchema, type Domain } from "../domain/categorization/category";
import { decodeBase64Url, encodeBase64Url, validateKeyVersion } from "./envelope";

/** A non-extractable data key and the version that must be placed in field AAD. */
export interface VersionedDataKey {
  readonly key: CryptoKey;
  readonly keyVersion: number;
}

/** Resolves active keys for encryption and exact historical keys for decryption. */
export interface KeyProvider {
  getDataKey(ownerId: string, domain: Domain, keyVersion?: number): Promise<VersionedDataKey>;
}

/** Persistable data-key ciphertext; it never contains the root key or plaintext data key. */
export interface WrappedDataKeyRecord {
  readonly version: 1;
  readonly algorithm: "A256GCM";
  readonly ownerId: string;
  readonly domain: Domain;
  readonly keyVersion: number;
  readonly iv: string;
  readonly wrappedKey: string;
}

/** Atomic persistence contract for encrypted data keys. */
export interface WrappedDataKeyStore {
  get(ownerId: string, domain: Domain, keyVersion: number): Promise<WrappedDataKeyRecord | undefined>;
  putIfAbsent(record: WrappedDataKeyRecord): Promise<WrappedDataKeyRecord>;
}

const wrappingTextEncoder = new TextEncoder();

/** Production key provider backed by a Worker root secret and encrypted data-key records. */
export class WrappedKeyProvider implements KeyProvider {
  readonly #rootKey: CryptoKey;
  readonly #store: WrappedDataKeyStore;
  #activeKeyVersion: number;

  constructor(rootKey: CryptoKey, store: WrappedDataKeyStore, activeKeyVersion: number) {
    validateWrappingKey(rootKey);
    this.#rootKey = rootKey;
    this.#store = store;
    this.#activeKeyVersion = validateKeyVersion(activeKeyVersion);
  }

  /** Returns the active key for encryption or an already-existing exact version for decryption. */
  async getDataKey(ownerId: string, domain: Domain, keyVersion?: number): Promise<VersionedDataKey> {
    validateOwnerAndDomain(ownerId, domain);

    if (keyVersion !== undefined) {
      const requestedVersion = validateKeyVersion(keyVersion);
      const existing = await this.#store.get(ownerId, domain, requestedVersion);
      if (!existing) {
        throw new Error("Unknown data-key version for the requested owner and domain.");
      }

      return {
        key: await unwrapDataKey(this.#rootKey, validateWrappedDataKey(existing, ownerId, domain, requestedVersion)),
        keyVersion: requestedVersion,
      };
    }

    const existing = await this.#store.get(ownerId, domain, this.#activeKeyVersion);
    const record =
      existing ??
      (await this.#store.putIfAbsent(
        await createWrappedDataKey(this.#rootKey, ownerId, domain, this.#activeKeyVersion),
      ));
    const validated = validateWrappedDataKey(record, ownerId, domain, this.#activeKeyVersion);

    return {
      key: await unwrapDataKey(this.#rootKey, validated),
      keyVersion: this.#activeKeyVersion,
    };
  }

  /** Advances the encryption version while retaining access to stored historical versions. */
  rotateTo(activeKeyVersion: number): void {
    const nextVersion = validateKeyVersion(activeKeyVersion);
    if (nextVersion <= this.#activeKeyVersion) {
      throw new Error("Active data-key rotation must move to a newer version.");
    }

    this.#activeKeyVersion = nextVersion;
  }
}

/** Imports a canonical base64url Worker secret and creates the wrapped-key provider. */
export async function createWrappedKeyProvider(
  rootKeyBase64Url: string,
  store: WrappedDataKeyStore,
  activeKeyVersion: number,
): Promise<WrappedKeyProvider> {
  const rawRootKey = decodeBase64Url(rootKeyBase64Url, "Root key");
  if (rawRootKey.byteLength !== 32) {
    throw new Error("Root key must be a 256-bit canonical base64url Worker secret.");
  }

  try {
    const rootKey = await crypto.subtle.importKey(
      "raw",
      rawRootKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    return new WrappedKeyProvider(rootKey, store, activeKeyVersion);
  } finally {
    // The decoded root bytes are short-lived and never placed on the provider object, in storage, or in logs.
    rawRootKey.fill(0);
  }
}

/** Generates a distinct raw data key and immediately wraps it with the root key. */
async function createWrappedDataKey(
  rootKey: CryptoKey,
  ownerId: string,
  domain: Domain,
  keyVersion: number,
): Promise<WrappedDataKeyRecord> {
  const rawDataKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  try {
    const wrappedKey = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: encodeWrappingAad(ownerId, domain, keyVersion),
        tagLength: 128,
      },
      rootKey,
      rawDataKey,
    );

    return {
      version: 1,
      algorithm: "A256GCM",
      ownerId,
      domain,
      keyVersion,
      iv: encodeBase64Url(iv),
      wrappedKey: encodeBase64Url(new Uint8Array(wrappedKey)),
    };
  } finally {
    rawDataKey.fill(0);
  }
}

/** Authenticates a wrapped record and imports its data key as non-extractable. */
async function unwrapDataKey(rootKey: CryptoKey, record: WrappedDataKeyRecord): Promise<CryptoKey> {
  const rawDataKey = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(record.iv, "Wrapped data-key IV"),
        additionalData: encodeWrappingAad(record.ownerId, record.domain, record.keyVersion),
        tagLength: 128,
      },
      rootKey,
      decodeBase64Url(record.wrappedKey, "Wrapped data key"),
    ),
  );

  if (rawDataKey.byteLength !== 32) {
    rawDataKey.fill(0);
    throw new Error("Wrapped data key must decrypt to 256 bits.");
  }

  try {
    return await crypto.subtle.importKey(
      "raw",
      rawDataKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    rawDataKey.fill(0);
  }
}

/** Strictly validates wrapped-key format, metadata, algorithm, and binary lengths. */
function validateWrappedDataKey(
  value: WrappedDataKeyRecord,
  ownerId: string,
  domain: Domain,
  keyVersion: number,
): WrappedDataKeyRecord {
  const expectedKeys = ["algorithm", "domain", "iv", "keyVersion", "ownerId", "version", "wrappedKey"];
  if (
    typeof value !== "object" ||
    value === null ||
    Object.keys(value).sort().join(",") !== expectedKeys.sort().join(",") ||
    value.version !== 1 ||
    value.algorithm !== "A256GCM"
  ) {
    throw new Error("Unsupported wrapped data-key envelope.");
  }

  if (value.ownerId !== ownerId || value.domain !== domain || value.keyVersion !== keyVersion) {
    throw new Error("Wrapped data-key metadata does not match the requested owner, domain, and version.");
  }

  if (
    decodeBase64Url(value.iv, "Wrapped data-key IV").byteLength !== 12 ||
    decodeBase64Url(value.wrappedKey, "Wrapped data key").byteLength !== 48
  ) {
    throw new Error("Wrapped data-key envelope has invalid binary lengths.");
  }

  return value;
}

/** Encodes collision-free AAD binding a wrapped key to its owner, domain, and version. */
function encodeWrappingAad(ownerId: string, domain: Domain, keyVersion: number): Uint8Array<ArrayBuffer> {
  return wrappingTextEncoder.encode(JSON.stringify(["vision-data-key-wrap", 1, ownerId, domain, keyVersion]));
}

/** Validates the identifiers used to partition data keys. */
function validateOwnerAndDomain(ownerId: string, domain: Domain): void {
  if (typeof ownerId !== "string" || ownerId.length === 0) {
    throw new Error("Data-key owner ID must be a non-empty string.");
  }

  DomainSchema.parse(domain);
}

/** Ensures the root key is non-extractable AES-256-GCM with wrap and unwrap capabilities. */
function validateWrappingKey(rootKey: CryptoKey): void {
  const algorithm = rootKey.algorithm as AesKeyAlgorithm;
  if (
    rootKey.type !== "secret" ||
    rootKey.extractable ||
    algorithm.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !rootKey.usages.includes("encrypt") ||
    !rootKey.usages.includes("decrypt")
  ) {
    throw new Error("Root key must be a non-extractable 256-bit AES-GCM wrapping key.");
  }
}
