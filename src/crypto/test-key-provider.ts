/** Supplies an unmistakably test-only wrapped-key provider with no production environment path. */
import type { Domain } from "../domain/categorization/category";
import {
  createWrappedKeyProvider,
  type KeyProvider,
  type VersionedDataKey,
  type WrappedDataKeyRecord,
  type WrappedDataKeyStore,
  type WrappedKeyProvider,
} from "./key-provider";

const TEST_ONLY_ROOT_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Construction options intentionally incompatible with Vision's production RuntimeEnv. */
export interface TestKeyProviderOptions {
  readonly environment: "test";
  readonly activeKeyVersion?: number;
}

/** Test harness exposing wrapped records without exposing plaintext keys. */
export interface TestKeyProvider extends KeyProvider {
  rotateTo(activeKeyVersion: number): void;
  readWrappedDataKeyForTest(
    ownerId: string,
    domain: Domain,
    keyVersion: number,
  ): Promise<WrappedDataKeyRecord | undefined>;
}

/** Creates a test-only provider and rejects any runtime attempt to select it outside tests. */
export function createTestKeyProvider(options: TestKeyProviderOptions): TestKeyProvider {
  if (options.environment !== "test") {
    throw new Error("The test-only key provider cannot be selected by a production environment.");
  }

  return new LazyTestKeyProvider(options.activeKeyVersion ?? 1);
}

/** Lazily initializes the Web Crypto provider so test setup remains synchronous. */
class LazyTestKeyProvider implements TestKeyProvider {
  readonly #store = new InMemoryWrappedDataKeyStore();
  readonly #initialVersion: number;
  #provider: Promise<WrappedKeyProvider> | undefined;
  #pendingRotation: number | undefined;

  constructor(initialVersion: number) {
    this.#initialVersion = initialVersion;
  }

  /** Resolves an active or historical data key through the real wrapping implementation. */
  async getDataKey(ownerId: string, domain: Domain, keyVersion?: number): Promise<VersionedDataKey> {
    return (await this.getProvider()).getDataKey(ownerId, domain, keyVersion);
  }

  /** Schedules or applies a test data-key rotation. */
  rotateTo(activeKeyVersion: number): void {
    if (this.#provider) {
      this.#provider = this.#provider.then((provider) => {
        provider.rotateTo(activeKeyVersion);
        return provider;
      });
      return;
    }

    this.#pendingRotation = activeKeyVersion;
  }

  /** Returns only the encrypted record used to assert owner/domain separation in tests. */
  async readWrappedDataKeyForTest(
    ownerId: string,
    domain: Domain,
    keyVersion: number,
  ): Promise<WrappedDataKeyRecord | undefined> {
    return this.#store.get(ownerId, domain, keyVersion);
  }

  /** Creates the real wrapped provider with the fixed test-only root exactly once. */
  private async getProvider(): Promise<WrappedKeyProvider> {
    if (!this.#provider) {
      this.#provider = createWrappedKeyProvider(TEST_ONLY_ROOT_KEY, this.#store, this.#initialVersion);
      if (this.#pendingRotation !== undefined) {
        const pendingRotation = this.#pendingRotation;
        this.#provider = this.#provider.then((provider) => {
          provider.rotateTo(pendingRotation);
          return provider;
        });
        this.#pendingRotation = undefined;
      }
    }

    return this.#provider;
  }
}

/** In-memory encrypted-record store that exists only behind the explicit test factory. */
class InMemoryWrappedDataKeyStore implements WrappedDataKeyStore {
  readonly #records = new Map<string, WrappedDataKeyRecord>();

  /** Reads one wrapped record by its full owner/domain/version partition. */
  async get(ownerId: string, domain: Domain, keyVersion: number): Promise<WrappedDataKeyRecord | undefined> {
    return this.#records.get(createStoreKey(ownerId, domain, keyVersion));
  }

  /** Atomically preserves the first wrapped record for a partition. */
  async putIfAbsent(record: WrappedDataKeyRecord): Promise<WrappedDataKeyRecord> {
    const key = createStoreKey(record.ownerId, record.domain, record.keyVersion);
    const existing = this.#records.get(key);
    if (existing) {
      return existing;
    }

    this.#records.set(key, record);
    return record;
  }
}

/** Creates an unambiguous in-memory key for one wrapped data-key partition. */
function createStoreKey(ownerId: string, domain: Domain, keyVersion: number): string {
  return JSON.stringify([ownerId, domain, keyVersion]);
}
