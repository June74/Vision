import { describe, expect, it } from "vitest";
import {
  authorizeIdentity,
  type IdentityAllowlist,
  type ServerVerifiedGoogleClaims,
} from "../../../src/domain/auth/identity";

describe("private-pilot identity authorization", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");
  const allowlist: IdentityAllowlist = {
    sub: "google-sub-1",
    email: "june@example.com",
    trustedAudience: "vision-web-client",
    trustedIssuer: "https://accounts.google.com",
  };
  const verifiedClaims: ServerVerifiedGoogleClaims = {
    audience: "vision-web-client",
    email: "June@Example.com",
    emailVerified: true,
    expiresAt: new Date("2026-07-23T12:01:00.000Z"),
    issuer: "https://accounts.google.com",
    sub: "google-sub-1",
  };

  it("authorizes only the exact server-verified subject and normalized allowlisted email", () => {
    expect(authorizeIdentity(verifiedClaims, allowlist, now)).toEqual({
      email: "june@example.com",
      subject: "google-sub-1",
    });
  });

  it("denies a different subject with the constant safe error", () => {
    expect(() =>
      authorizeIdentity({ ...verifiedClaims, sub: "google-sub-2" }, allowlist, now),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it("denies an unverified email with the constant safe error", () => {
    expect(() =>
      authorizeIdentity({ ...verifiedClaims, emailVerified: false }, allowlist, now),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it("denies a claim from an untrusted issuer", () => {
    expect(() =>
      authorizeIdentity({ ...verifiedClaims, issuer: "https://untrusted.example" }, allowlist, now),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it("denies a claim for a different audience", () => {
    expect(() =>
      authorizeIdentity({ ...verifiedClaims, audience: "other-client" }, allowlist, now),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it.each([
    ["one-element audience array", ["vision-web-client"]],
    ["mixed audience array", ["vision-web-client", "other-client"]],
  ])("denies a %s with the constant safe error", (_description, audience) => {
    expect(() =>
      authorizeIdentity({ ...verifiedClaims, audience: audience as unknown as string }, allowlist, now),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it("denies a claim that has expired at the injected current instant", () => {
    expect(() =>
      authorizeIdentity(
        { ...verifiedClaims, expiresAt: new Date("2026-07-23T12:00:00.000Z") },
        allowlist,
        now,
      ),
    ).toThrow("ACCOUNT_NOT_ALLOWED");
  });

  it("denies a missing subject without exposing identity details", () => {
    expect(() => authorizeIdentity({ ...verifiedClaims, sub: "" }, allowlist, now)).toThrow(
      "ACCOUNT_NOT_ALLOWED",
    );
  });

  it("uses the same safe error for malformed values without echoing claims or allowlist values", () => {
    const claimEmail = "untrusted@example.com";
    const allowlistedEmail = "june@example.com";
    try {
      authorizeIdentity({ ...verifiedClaims, email: claimEmail }, { ...allowlist, email: allowlistedEmail }, now);
      throw new Error("Expected authorization to fail");
    } catch (error) {
      expect(error).toHaveProperty("message", "ACCOUNT_NOT_ALLOWED");
      expect((error as Error).message).not.toContain(claimEmail);
      expect((error as Error).message).not.toContain(allowlistedEmail);
    }
  });

  it("denies a hostile non-object claim input with the constant safe error", () => {
    expect(() => authorizeIdentity(null as unknown as ServerVerifiedGoogleClaims, allowlist, now)).toThrow(
      "ACCOUNT_NOT_ALLOWED",
    );
  });
});
