import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Vision Worker", () => {
  it("reports a healthy API", async () => {
    const response = await SELF.fetch("https://vision.test/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "vision" });
  });
});
