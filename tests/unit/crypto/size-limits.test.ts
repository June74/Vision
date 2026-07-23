import { describe, expect, it, vi } from "vitest";
import {
  MAX_PROTECTED_PLAINTEXT_BYTES,
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
  decryptText,
  encryptText,
  parseCipherEnvelope,
  type CipherEnvelope,
} from "../../../src/crypto/envelope";

async function createDataKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

describe("protected envelope size admission", () => {
  it("rejects oversized plaintext before UTF-8 encryption", async () => {
    const key = await createDataKey();

    await expect(
      encryptText(key, "a".repeat(MAX_PROTECTED_PLAINTEXT_BYTES + 1), {
        ownerId: "owner-1",
        nodeId: "node-1",
        domain: "work",
        fieldName: "description",
        keyVersion: 1,
      }),
    ).rejects.toThrow(/size/u);
  });

  it("rejects oversized IV and ciphertext strings before base64 decoding", async () => {
    const key = await createDataKey();
    const valid = await encryptText(key, "bounded", {
      ownerId: "owner-1",
      nodeId: "node-1",
      domain: "work",
      fieldName: "title",
      keyVersion: 1,
    });
    const atobSpy = vi.spyOn(globalThis, "atob");

    try {
      await expect(decryptText(key, { ...valid, iv: "A".repeat(18) } as CipherEnvelope, {
        ownerId: "owner-1",
        nodeId: "node-1",
        domain: "work",
        fieldName: "title",
        keyVersion: 1,
      })).rejects.toThrow(/IV/u);
      expect(atobSpy).not.toHaveBeenCalled();

      atobSpy.mockClear();
      await expect(decryptText(key, { ...valid, ciphertext: "A".repeat(90_000) } as CipherEnvelope, {
        ownerId: "owner-1",
        nodeId: "node-1",
        domain: "work",
        fieldName: "title",
        keyVersion: 1,
      })).rejects.toThrow(/size/u);
      expect(atobSpy).not.toHaveBeenCalled();
    } finally {
      atobSpy.mockRestore();
    }
  });

  it("rejects oversized serialized envelopes before JSON parsing", () => {
    const parseSpy = vi.spyOn(JSON, "parse");

    try {
      expect(() => parseCipherEnvelope(" ".repeat(MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS + 1))).toThrow(/size/u);
      expect(parseSpy).not.toHaveBeenCalled();
    } finally {
      parseSpy.mockRestore();
    }
  });
});
