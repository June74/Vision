import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { decryptProtectedFields, encryptProtectedFields } from "../../../src/crypto/protected-fields";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";

const context = {
  ownerId: "owner-1",
  nodeId: "event-1",
  domain: "school",
} as const;

function createRandomTestRoot(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

describe("protected object fields", () => {
  it("encrypts every string field, preserves nulls, and restores the original object", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });
    const plaintext = {
      title: "VISION_PROTECTED_SENTINEL_7F9A",
      description: null,
      attendees: '["private@example.test"]',
    };

    const encrypted = await encryptProtectedFields(provider, context, plaintext);

    expect(JSON.stringify(encrypted)).not.toContain("VISION_PROTECTED_SENTINEL_7F9A");
    expect(encrypted.title?.keyVersion).toBe(1);
    expect(encrypted.attendees?.keyVersion).toBe(1);
    expect(encrypted.description).toBeNull();
    await expect(decryptProtectedFields(provider, context, encrypted)).resolves.toEqual(plaintext);
  });

  it("rejects moving an encrypted value to another protected field", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });
    const encrypted = await encryptProtectedFields(provider, context, {
      title: "private title",
      description: "private description",
    });

    await expect(
      decryptProtectedFields(provider, context, {
        title: encrypted.description,
        description: encrypted.title,
      }),
    ).rejects.toThrow();
  });

  it("rejects the wrong node, owner, or domain context", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });
    const encrypted = await encryptProtectedFields(provider, context, { title: "private title" });

    await expect(decryptProtectedFields(provider, { ...context, nodeId: "event-2" }, encrypted)).rejects.toThrow();
    await expect(decryptProtectedFields(provider, { ...context, ownerId: "owner-2" }, encrypted)).rejects.toThrow();
    await expect(decryptProtectedFields(provider, { ...context, domain: "work" }, encrypted)).rejects.toThrow();
  });

  it("creates distinct wrapped data keys for each user and domain", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });

    await encryptProtectedFields(provider, context, { title: "school title" });
    await encryptProtectedFields(provider, { ...context, domain: "work" }, { title: "work title" });
    await encryptProtectedFields(provider, { ...context, ownerId: "owner-2" }, { title: "other title" });

    const school = await provider.readWrappedDataKeyForTest("owner-1", "school", 1);
    const work = await provider.readWrappedDataKeyForTest("owner-1", "work", 1);
    const otherOwner = await provider.readWrappedDataKeyForTest("owner-2", "school", 1);

    expect(school).toBeDefined();
    expect(work).toBeDefined();
    expect(otherOwner).toBeDefined();
    expect(school?.wrappedKey).not.toBe(work?.wrappedKey);
    expect(school?.wrappedKey).not.toBe(otherOwner?.wrappedKey);
    expect(JSON.stringify([school, work, otherOwner])).not.toContain("school title");
  });

  it("decrypts old versions but encrypts only with the active version after rotation", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });
    const oldEnvelope = await encryptProtectedFields(provider, context, { title: "old private title" });

    await provider.rotateTo(2);

    const newEnvelope = await encryptProtectedFields(provider, context, { title: "new private title" });
    expect(oldEnvelope.title?.keyVersion).toBe(1);
    expect(newEnvelope.title?.keyVersion).toBe(2);
    await expect(decryptProtectedFields(provider, context, oldEnvelope)).resolves.toEqual({
      title: "old private title",
    });
    await expect(decryptProtectedFields(provider, context, newEnvelope)).resolves.toEqual({
      title: "new private title",
    });
  });

  it("rejects unknown data-key versions and non-string protected values", async () => {
    const provider = await createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 });
    const encrypted = await encryptProtectedFields(provider, context, { title: "private title" });

    await expect(
      decryptProtectedFields(provider, context, {
        title: encrypted.title === null ? null : { ...encrypted.title, keyVersion: 99 },
      }),
    ).rejects.toThrow();
    await expect(
      encryptProtectedFields(provider, context, { title: 42 } as unknown as Record<string, string | null>),
    ).rejects.toThrow();
  });

  it("requires the actual Vitest runtime in addition to caller-supplied random test key material", async () => {
    const originalVitest = process.env.VITEST;
    delete process.env.VITEST;

    try {
      await expect(
        createTestKeyProvider({ rootKeyBase64Url: createRandomTestRoot(), activeKeyVersion: 1 }),
      ).rejects.toThrow(/Vitest/u);
    } finally {
      if (originalVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = originalVitest;
      }
    }
  });
});
