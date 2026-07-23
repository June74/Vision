import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeEnvSchema } from "../../../src/server/env";

const canonicalRootKey = "A".repeat(43);
const constantError =
  "KEY_ENCRYPTION_KEY must be a canonical 256-bit base64url secret.";
const decoderControl = vi.hoisted(() => ({
  decoded: new Uint8Array(32),
}));

vi.mock("../../../src/crypto/envelope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/crypto/envelope")>();
  return {
    ...actual,
    decodeBase64Url: vi.fn(() => decoderControl.decoded),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("KEY_ENCRYPTION_KEY validation buffer hygiene", () => {
  it("clears the controlled decoded buffer after successful validation", () => {
    const decoded = Uint8Array.from({ length: 32 }, () => 0x7a);
    const fillSpy = vi.spyOn(decoded, "fill");
    decoderControl.decoded = decoded;

    const result =
      RuntimeEnvSchema.shape.KEY_ENCRYPTION_KEY.safeParse(canonicalRootKey);

    expect(result.success).toBe(true);
    expect(fillSpy).toHaveBeenCalledOnce();
    expect(fillSpy).toHaveBeenCalledWith(0);
    expect(decoded).toEqual(new Uint8Array(32));
  });

  it("clears the controlled decoded buffer after decoded-length rejection", () => {
    const decoded = Uint8Array.from({ length: 31 }, () => 0x7a);
    const fillSpy = vi.spyOn(decoded, "fill");
    decoderControl.decoded = decoded;

    const result =
      RuntimeEnvSchema.shape.KEY_ENCRYPTION_KEY.safeParse(canonicalRootKey);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: constantError }),
        ]),
      );
      expect(result.error.message).not.toContain(canonicalRootKey);
    }
    expect(fillSpy).toHaveBeenCalledOnce();
    expect(fillSpy).toHaveBeenCalledWith(0);
    expect(decoded).toEqual(new Uint8Array(31));
  });
});
