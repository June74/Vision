import { describe, expect, it } from "vitest";
import {
  decryptText,
  encryptText,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
  type ProtectedFieldAad,
} from "../../../src/crypto/envelope";

const aad: ProtectedFieldAad = {
  ownerId: "owner-1",
  nodeId: "event-1",
  domain: "work",
  fieldName: "title",
  keyVersion: 1,
};

async function createDataKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function flipFirstBit(value: string): string {
  const bytes = decodeBase64Url(value);
  bytes[0] ^= 1;
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

describe("AES-GCM protected-field envelopes", () => {
  it("round-trips text without exposing plaintext in the JSON envelope", async () => {
    const key = await createDataKey();

    const encrypted = await encryptText(key, "private title", aad);

    expect(encrypted.version).toBe(2);
    expect(JSON.stringify(encrypted)).not.toContain("private title");
    await expect(decryptText(key, encrypted, aad)).resolves.toBe("private title");
  });

  it("decrypts the fixed legacy version-1 AAD vector without weakening version-2 domain binding", async () => {
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from({ length: 32 }, (_, index) => index),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const legacy: CipherEnvelope = {
      version: 1,
      algorithm: "A256GCM",
      keyVersion: 1,
      iv: "AAECAwQFBgcICQoL",
      ciphertext: "K2exeqac4mv_KOHqxYxYGeqi61GVZfPJHYSNsg62TPPqEcyn",
    };

    await expect(decryptText(key, legacy, aad)).resolves.toBe("legacy private title");
  });

  it("uses a fresh random 96-bit IV for every encryption", async () => {
    const key = await createDataKey();

    const first = await encryptText(key, "same plaintext", aad);
    const second = await encryptText(key, "same plaintext", aad);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(decodeBase64Url(first.iv)).toHaveLength(12);
    expect(decodeBase64Url(second.iv)).toHaveLength(12);
  });

  it("rejects ciphertext tampering", async () => {
    const key = await createDataKey();
    const encrypted = await encryptText(key, "private title", aad);

    await expect(
      decryptText(key, { ...encrypted, ciphertext: flipFirstBit(encrypted.ciphertext) }, aad),
    ).rejects.toThrow();
  });

  it.each([
    [{ ...aad, ownerId: "owner-2" }, "owner"],
    [{ ...aad, nodeId: "event-2" }, "node"],
    [{ ...aad, domain: "school" }, "domain"],
    [{ ...aad, fieldName: "description" }, "field"],
    [{ ...aad, keyVersion: 2 }, "key version"],
  ] satisfies Array<[ProtectedFieldAad, string]>)("rejects mismatched %s additional data", async (wrongAad) => {
    const key = await createDataKey();
    const encrypted = await encryptText(key, "private title", aad);

    await expect(decryptText(key, encrypted, wrongAad)).rejects.toThrow();
  });

  it.each([
    [{ version: 3 }, "envelope version"],
    [{ algorithm: "AES-CBC" }, "algorithm"],
    [{ keyVersion: 0 }, "key version"],
    [{ iv: "not+padded/base64==" }, "IV base64url"],
    [{ iv: "AA" }, "IV length"],
    [{ ciphertext: "not+padded/base64==" }, "ciphertext base64url"],
    [{ ciphertext: "" }, "empty ciphertext"],
  ] satisfies Array<[Record<string, unknown>, string]>)(
    "rejects malformed or unknown %s values",
    async (change, _label) => {
      const key = await createDataKey();
      const encrypted = await encryptText(key, "private title", aad);

      await expect(decryptText(key, { ...encrypted, ...change } as CipherEnvelope, aad)).rejects.toThrow();
    },
  );

  it("strictly validates serialized JSON envelope boundaries", async () => {
    const key = await createDataKey();
    const encrypted = await encryptText(key, "private title", aad);
    const serialized = serializeCipherEnvelope(encrypted);

    expect(parseCipherEnvelope(serialized)).toEqual(encrypted);
    expect(() => parseCipherEnvelope("{not-json")).toThrow();
    expect(() => parseCipherEnvelope(JSON.stringify({ ...encrypted, plaintext: "leak" }))).toThrow();
    expect(() => parseCipherEnvelope(JSON.stringify({ ...encrypted, iv: `${encrypted.iv}=` }))).toThrow();
  });
});
