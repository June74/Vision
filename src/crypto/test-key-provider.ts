/** Supplies a Vitest-only wrapped-key harness without embedding any known root key. */
import type { Domain } from "../domain/categorization/category";
import {
  createWrappedKeyProvider,
  type VersionedDataKey,
  type WrappedDataKeyRecord,
  type WrappedDataKeyStore,
  type WrappedKeyProvider,
} from "./key-provider";

/** Marker that the production post-build validator forbids in the Worker bundle. */
export const TEST_KEY_PROVIDER_BUNDLE_MARKER =
  "VISION_TEST_PROVIDER_MODULE_MUST_NOT_REACH_PRODUCTION_BUNDLE";

/** Construction options require test-generated key material rather than a source-controlled key. */
export interface TestKeyProviderOptions {
  readonly rootKeyBase64Url: string;
  readonly activeKeyVersion?: number;
}

/** Vitest harness exposing wrapped records without exposing plaintext keys. */
export interface TestKeyProvider extends WrappedKeyProvider {
  readWrappedDataKeyForTest(
    ownerId: string,
    domain: Domain,
    keyVersion: number,
  ): Promise<WrappedDataKeyRecord | undefined>;
}

/** Creates a provider only inside the actual Vitest mode with caller-generated test key material. */
export async function createTestKeyProvider(options: TestKeyProviderOptions): Promise<TestKeyProvider> {
  assertVitestRuntime();
  const store = new InMemoryWrappedDataKeyStore();
  const provider = await createWrappedKeyProvider(
    options.rootKeyBase64Url,
    store,
    options.activeKeyVersion ?? 1,
  );
  return new TestKeyProviderHarness(provider, store);
}

/** Delegates cryptographic behavior to the production provider while exposing encrypted test records. */
class TestKeyProviderHarness implements TestKeyProvider {
  readonly #provider: WrappedKeyProvider;
  readonly #store: InMemoryWrappedDataKeyStore;

  constructor(provider: WrappedKeyProvider, store: InMemoryWrappedDataKeyStore) {
    this.#provider = provider;
    this.#store = store;
  }

  /** Resolves an active or historical data key through the production implementation. */
  async getDataKey(ownerId: string, domain: Domain, keyVersion?: number): Promise<VersionedDataKey> {
    return this.#provider.getDataKey(ownerId, domain, keyVersion);
  }

  /** Atomically advances the in-memory authoritative high-water mark. */
  async rotateTo(activeKeyVersion: number): Promise<void> {
    await this.#provider.rotateTo(activeKeyVersion);
  }

  /** Returns only the encrypted record used to assert owner/domain separation in tests. */
  async readWrappedDataKeyForTest(
    ownerId: string,
    domain: Domain,
    keyVersion: number,
  ): Promise<WrappedDataKeyRecord | undefined> {
    return this.#store.get(ownerId, domain, keyVersion);
  }
}

/** In-memory encrypted-record and active-version store used only behind the guarded factory. */
class InMemoryWrappedDataKeyStore implements WrappedDataKeyStore {
  readonly #records = new Map<string, WrappedDataKeyRecord>();
  #activeKeyVersion: number | undefined;

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

  /** Reads the authoritative active-version high-water mark. */
  async getActiveKeyVersion(): Promise<number | undefined> {
    return this.#activeKeyVersion;
  }

  /** Atomically raises, but never lowers, the authoritative active-version high-water mark. */
  async activateKeyVersion(candidate: number): Promise<number> {
    this.#activeKeyVersion = Math.max(this.#activeKeyVersion ?? candidate, candidate);
    return this.#activeKeyVersion;
  }
}

/** Rejects construction unless both Node test mode and the Vitest runtime sentinel are present. */
function assertVitestRuntime(): void {
  if (process.env.NODE_ENV !== "test" || process.env.VITEST !== "true") {
    throw new Error(`${TEST_KEY_PROVIDER_BUNDLE_MARKER}: construction requires the actual Vitest runtime.`);
  }
}

/** Creates an unambiguous in-memory key for one wrapped data-key partition. */
function createStoreKey(ownerId: string, domain: Domain, keyVersion: number): string {
  return JSON.stringify([ownerId, domain, keyVersion]);
}
