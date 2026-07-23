import { describe, expect, it, vi } from "vitest";
import { decryptText, encodeBase64Url, encryptText } from "../../../src/crypto/envelope";
import {
  createWrappedKeyProvider,
  type WrappedDataKeyRecord,
  type WrappedDataKeyStore,
} from "../../../src/crypto/key-provider";
import type { Domain } from "../../../src/domain/categorization/category";

function createRandomRoot(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function recordKey(ownerId: string, domain: Domain, keyVersion: number): string {
  return JSON.stringify([ownerId, domain, keyVersion]);
}

class AuthoritativeMemoryStore implements WrappedDataKeyStore {
  readonly records = new Map<string, WrappedDataKeyRecord>();
  activeKeyVersion: number | undefined;
  private pauseResolution = false;
  private pausedResolver: (() => void) | undefined;
  private releaseResolver: (() => void) | undefined;
  private capturedActiveVersion: number | undefined;
  private capturedRecord: WrappedDataKeyRecord | undefined;

  async get(ownerId: string, domain: Domain, keyVersion: number): Promise<WrappedDataKeyRecord | undefined> {
    const record = this.records.get(recordKey(ownerId, domain, keyVersion));
    if (!this.pauseResolution) {
      return record;
    }

    this.capturedRecord = record;
    this.pauseResolution = false;
    this.pausedResolver?.();
    await new Promise<void>((resolve) => {
      this.releaseResolver = resolve;
    });
    return this.capturedRecord;
  }

  async putIfAbsent(record: WrappedDataKeyRecord): Promise<WrappedDataKeyRecord> {
    const key = recordKey(record.ownerId, record.domain, record.keyVersion);
    const existing = this.records.get(key);
    if (existing) {
      return existing;
    }

    this.records.set(key, record);
    return record;
  }

  async getActiveKeyVersion(): Promise<number | undefined> {
    if (!this.pauseResolution) {
      return this.activeKeyVersion;
    }

    this.capturedActiveVersion = this.activeKeyVersion;
    this.pauseResolution = false;
    this.pausedResolver?.();
    await new Promise<void>((resolve) => {
      this.releaseResolver = resolve;
    });
    return this.capturedActiveVersion;
  }

  async activateKeyVersion(candidate: number): Promise<number> {
    this.activeKeyVersion = Math.max(this.activeKeyVersion ?? candidate, candidate);
    return this.activeKeyVersion;
  }

  pauseNextResolution(): Promise<void> {
    this.pauseResolution = true;
    return new Promise<void>((resolve) => {
      this.pausedResolver = resolve;
    });
  }

  releaseResolution(): void {
    this.releaseResolver?.();
    this.releaseResolver = undefined;
    this.pausedResolver = undefined;
  }
}

class CompetingVersionStore extends AuthoritativeMemoryStore {
  private higherActivation: (() => void) | undefined;
  private readonly higherActivated = new Promise<void>((resolve) => {
    this.higherActivation = resolve;
  });

  override async activateKeyVersion(candidate: number): Promise<number> {
    if (candidate === 2) {
      await this.higherActivated;
    }

    const active = await super.activateKeyVersion(candidate);
    if (candidate === 3) {
      this.higherActivation?.();
    }
    return active;
  }
}

describe("WrappedKeyProvider active-version authority", () => {
  it("keeps one immutable key version when rotation overlaps an active key lookup", async () => {
    const store = new AuthoritativeMemoryStore();
    const provider = await createWrappedKeyProvider(createRandomRoot(), store, 1);
    await provider.getDataKey("owner-1", "school");

    const paused = store.pauseNextResolution();
    const overlappingLookup = provider.getDataKey("owner-1", "school");
    await paused;
    await provider.rotateTo(2);
    store.releaseResolution();

    const overlappingKey = await overlappingLookup;
    expect(overlappingKey.keyVersion).toBe(1);
    const envelope = await encryptText(overlappingKey.key, "linearizable", {
      ownerId: "owner-1",
      nodeId: "node-1",
      fieldName: "title",
      keyVersion: overlappingKey.keyVersion,
    });
    const historical = await provider.getDataKey("owner-1", "school", overlappingKey.keyVersion);
    await expect(
      decryptText(historical.key, envelope, {
        ownerId: "owner-1",
        nodeId: "node-1",
        fieldName: "title",
        keyVersion: overlappingKey.keyVersion,
      }),
    ).resolves.toBe("linearizable");
    await expect(provider.getDataKey("owner-1", "school")).resolves.toMatchObject({ keyVersion: 2 });
  });

  it("persists the active high-water mark across reconstruction and rejects stale configuration", async () => {
    const root = createRandomRoot();
    const store = new AuthoritativeMemoryStore();
    const first = await createWrappedKeyProvider(root, store, 1);
    const oldKey = await first.getDataKey("owner-1", "work");
    const oldEnvelope = await encryptText(oldKey.key, "historical", {
      ownerId: "owner-1",
      nodeId: "node-1",
      fieldName: "description",
      keyVersion: 1,
    });

    await first.rotateTo(2);
    await expect(createWrappedKeyProvider(root, store, 1)).rejects.toThrow(/stale/u);
    const restarted = await createWrappedKeyProvider(root, store, 2);
    await expect(restarted.getDataKey("owner-1", "work")).resolves.toMatchObject({ keyVersion: 2 });
    const historical = await restarted.getDataKey("owner-1", "work", 1);
    await expect(
      decryptText(historical.key, oldEnvelope, {
        ownerId: "owner-1",
        nodeId: "node-1",
        fieldName: "description",
        keyVersion: 1,
      }),
    ).resolves.toBe("historical");
  });

  it("atomically rejects a lower competing activation after a higher version wins", async () => {
    const root = createRandomRoot();
    const store = new CompetingVersionStore();
    await createWrappedKeyProvider(root, store, 1);

    const [lower, higher] = await Promise.allSettled([
      createWrappedKeyProvider(root, store, 2),
      createWrappedKeyProvider(root, store, 3),
    ]);

    expect(lower.status).toBe("rejected");
    expect(higher.status).toBe("fulfilled");
    expect(await store.getActiveKeyVersion()).toBe(3);
    if (higher.status === "fulfilled") {
      await expect(higher.value.getDataKey("owner-1", "personal")).resolves.toMatchObject({ keyVersion: 3 });
    }
  });

  it("rejects oversized wrapped IV and key values before base64 decoding", async () => {
    const store = new AuthoritativeMemoryStore();
    const provider = await createWrappedKeyProvider(createRandomRoot(), store, 1);
    await provider.getDataKey("owner-1", "school");
    const key = recordKey("owner-1", "school", 1);
    const original = store.records.get(key) as WrappedDataKeyRecord;
    const atobSpy = vi.spyOn(globalThis, "atob");

    try {
      store.records.set(key, { ...original, iv: "A".repeat(18) });
      await expect(provider.getDataKey("owner-1", "school", 1)).rejects.toThrow(/IV/u);
      expect(atobSpy).not.toHaveBeenCalled();

      atobSpy.mockClear();
      store.records.set(key, { ...original, wrappedKey: "A".repeat(1_000) });
      await expect(provider.getDataKey("owner-1", "school", 1)).rejects.toThrow(/size/u);
      expect(atobSpy).not.toHaveBeenCalled();
    } finally {
      atobSpy.mockRestore();
    }
  });
});
