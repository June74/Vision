import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../../src/crypto/envelope";
import { createAuthAdmissionKeyFactory } from "../../../../src/server/auth/admission";

const rootKey = encodeBase64Url(new Uint8Array(32).fill(7));

function cloudflareRequest(address: string): Request {
  const request = new Request("https://vision.example.test/api/auth/google/start", {
    headers: {
      "cf-connecting-ip": address,
      "x-forwarded-for": "203.0.113.200",
    },
  });
  Object.defineProperty(request, "cf", {
    configurable: true,
    value: Object.freeze({ colo: "ORD" }),
  });
  return request;
}

describe("privacy-safe OAuth admission keys", () => {
  it("ignores spoofable forwarding data without trusted Cloudflare metadata", async () => {
    const preview = await createAuthAdmissionKeyFactory(rootKey, "preview");
    const local = await createAuthAdmissionKeyFactory(rootKey, "local");
    const attackerOne = new Request("https://vision.example.test", {
      headers: {
        "cf-connecting-ip": "192.0.2.1",
        "x-forwarded-for": "192.0.2.1",
      },
    });
    const attackerTwo = new Request("https://vision.example.test", {
      headers: {
        "cf-connecting-ip": "198.51.100.2",
        "x-forwarded-for": "198.51.100.2",
      },
    });

    await expect(preview(attackerOne)).resolves.toBe(
      await preview(attackerTwo),
    );
    await expect(local(cloudflareRequest("192.0.2.1"))).resolves.toBe(
      await local(cloudflareRequest("198.51.100.2")),
    );
  });

  it("separates trusted edge clients but binds a verified session owner independently of IP", async () => {
    const admissionKey = await createAuthAdmissionKeyFactory(
      rootKey,
      "production",
    );
    const first = await admissionKey(cloudflareRequest("192.0.2.1"));
    const second = await admissionKey(cloudflareRequest("198.51.100.2"));
    const ownerFromFirst = await admissionKey(
      cloudflareRequest("192.0.2.1"),
      "usr_private_pilot",
    );
    const ownerFromSecond = await admissionKey(
      cloudflareRequest("198.51.100.2"),
      "usr_private_pilot",
    );

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(first).not.toBe(second);
    expect(ownerFromFirst).toBe(ownerFromSecond);
    expect(
      `${first}${second}${ownerFromFirst}${ownerFromSecond}`,
    ).not.toMatch(/192\.0\.2\.1|198\.51\.100\.2|usr_private_pilot/u);
  });

  it("derives a distinct HMAC key instead of reusing root wrapping bytes directly", async () => {
    const admissionKey = await createAuthAdmissionKeyFactory(rootKey, "local");
    const actual = await admissionKey(
      new Request("http://localhost/api/auth/google/start"),
    );
    const directKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(32).fill(7),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const direct = encodeBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          directKey,
          new TextEncoder().encode(
            "vision-auth-start:v1:untrusted-shared",
          ),
        ),
      ),
    );

    expect(actual).not.toBe(direct);
  });
});
