import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Vision Worker error envelopes", () => {
  it("returns a private JSON envelope for an unknown API route", async () => {
    const response = await SELF.fetch("https://vision.test/api/unknown");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.clone().text()).resolves.not.toContain("stack");
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "API route not found.",
        requestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });
});
