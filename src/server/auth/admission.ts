/** Derives privacy-safe OAuth admission keys without trusting caller-supplied forwarding headers. */
import { decodeBase64Url, encodeBase64Url } from "../../crypto/envelope";

/** Server-owned admission-key function optionally bound to an already verified session owner. */
export type AuthAdmissionKeyFactory = (
  request: Request,
  authenticatedOwnerId?: string,
) => Promise<string>;

/** Creates one domain-separated HMAC admission-key factory from the existing Worker root key. */
export async function createAuthAdmissionKeyFactory(
  rootKeyBase64Url: string,
  environment: "local" | "preview" | "production",
): Promise<AuthAdmissionKeyFactory> {
  const rootKey = decodeBase64Url(
    rootKeyBase64Url,
    "Vision key-encryption key",
    43,
  );
  if (rootKey.byteLength !== 32) {
    throw new Error("Invalid admission-key material.");
  }
  let key: CryptoKey;
  try {
    const inputKey = await crypto.subtle.importKey(
      "raw",
      rootKey,
      "HKDF",
      false,
      ["deriveKey"],
    );
    const encoder = new TextEncoder();
    key = await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: encoder.encode("vision-auth-admission-salt:v1"),
        info: encoder.encode("vision-auth-admission-hmac:v1"),
      },
      inputKey,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    );
  } finally {
    rootKey.fill(0);
  }
  return async (request, authenticatedOwnerId) => {
    const source = authenticatedOwnerId
      ? `session:${authenticatedOwnerId}`
      : readTrustedCloudflareClient(request, environment) ??
        "untrusted-shared";
    const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`vision-auth-start:v1:${source}`),
    );
    return encodeBase64Url(new Uint8Array(digest));
  };
}

/** Trusts `CF-Connecting-IP` only alongside non-local Cloudflare request metadata. */
function readTrustedCloudflareClient(
  request: Request,
  environment: "local" | "preview" | "production",
): string | undefined {
  if (environment === "local") return undefined;
  try {
    const cf = (request as Request & { cf?: unknown }).cf;
    if (typeof cf !== "object" || cf === null) return undefined;
    const colo = Object.getOwnPropertyDescriptor(cf, "colo");
    if (
      !colo ||
      !("value" in colo) ||
      typeof colo.value !== "string" ||
      !/^[A-Z0-9]{3,8}$/u.test(colo.value)
    ) {
      return undefined;
    }
    const clientAddress = request.headers.get("cf-connecting-ip");
    if (
      !clientAddress ||
      clientAddress.length > 64 ||
      !/^[0-9a-f:.]+$/iu.test(clientAddress)
    ) {
      return undefined;
    }
    return `cf:${clientAddress.toLowerCase()}`;
  } catch {
    return undefined;
  }
}
