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
  getActiveKeyVersion(): Promise<number | undefined>;
  activateKeyVersion(candidate: number): Promise<number>;
}

const wrappingTextEncoder = new TextEncoder();
const ROOT_KEY_BASE64URL_CHARS = 43;
const WRAPPED_KEY_IV_BASE64URL_CHARS = 16;
const WRAPPED_KEY_BASE64URL_CHARS = 64;

/** Store-authorized key provider with asynchronous monotonic rotation. */
export interface WrappedKeyProvider extends KeyProvider {
  rotateTo(activeKeyVersion: number): Promise<void>;
}

/** Production implementation backed by a Worker root secret and authoritative wrapped-key store. */
class StoreBackedWrappedKeyProvider implements WrappedKeyProvider {
  readonly #rootKey: CryptoKey;
  readonly #store: WrappedDataKeyStore;

  constructor(rootKey: CryptoKey, store: WrappedDataKeyStore) {
    validateWrappingKey(rootKey);
    this.#rootKey = rootKey;
    this.#store = store;
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

    // This immutable snapshot is the linearization point for the complete active-key resolution.
    const activeKeyVersion = validateKeyVersion(await this.#store.getActiveKeyVersion());
    const existing = await this.#store.get(ownerId, domain, activeKeyVersion);
    const record =
      existing ??
      (await this.#store.putIfAbsent(
        await createWrappedDataKey(this.#rootKey, ownerId, domain, activeKeyVersion),
      ));
    const validated = validateWrappedDataKey(record, ownerId, domain, activeKeyVersion);

    return {
      key: await unwrapDataKey(this.#rootKey, validated),
      keyVersion: activeKeyVersion,
    };
  }

  /** Atomically advances the authoritative store version while retaining historical keys. */
  async rotateTo(activeKeyVersion: number): Promise<void> {
    const nextVersion = validateKeyVersion(activeKeyVersion);
    const currentVersion = validateKeyVersion(await this.#store.getActiveKeyVersion());
    if (nextVersion <= currentVersion) {
      throw new Error("Active data-key rotation must move to a newer version.");
    }

    const authoritativeVersion = validateKeyVersion(await this.#store.activateKeyVersion(nextVersion));
    if (authoritativeVersion !== nextVersion) {
      throw new Error("Data-key activation lost to a newer authoritative version.");
    }
  }
}

/** Imports a canonical base64url Worker secret and creates the wrapped-key provider. */
export async function createWrappedKeyProvider(
  rootKeyBase64Url: string,
  store: WrappedDataKeyStore,
  activeKeyVersion: number,
): Promise<WrappedKeyProvider> {
  if (typeof rootKeyBase64Url !== "string" || rootKeyBase64Url.length !== ROOT_KEY_BASE64URL_CHARS) {
    throw new Error("Root key must be a 256-bit canonical base64url Worker secret.");
  }

  const configuredVersion = validateKeyVersion(activeKeyVersion);
  const rawRootKey = decodeBase64Url(rootKeyBase64Url, "Root key", ROOT_KEY_BASE64URL_CHARS);
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
    const authoritativeVersion = validateKeyVersion(await store.activateKeyVersion(configuredVersion));
    if (authoritativeVersion !== configuredVersion) {
      throw new Error("Configured data-key version is stale relative to the authoritative store.");
    }

    return new StoreBackedWrappedKeyProvider(rootKey, store);
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

  if (typeof value.iv !== "string" || value.iv.length !== WRAPPED_KEY_IV_BASE64URL_CHARS) {
    throw new Error("Wrapped data-key IV must be 96 bits.");
  }

  if (typeof value.wrappedKey !== "string" || value.wrappedKey.length !== WRAPPED_KEY_BASE64URL_CHARS) {
    throw new Error("Wrapped data key exceeds or does not match the required encoded size.");
  }

  // Both exact encoded sizes are admitted before atob creates either decoded copy.
  if (
    decodeBase64Url(value.iv, "Wrapped data-key IV", WRAPPED_KEY_IV_BASE64URL_CHARS).byteLength !== 12 ||
    decodeBase64Url(value.wrappedKey, "Wrapped data key", WRAPPED_KEY_BASE64URL_CHARS).byteLength !== 48
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
