import { SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

describe("Vision Worker error envelopes", () => {
  it("returns a private JSON envelope for an unknown API route", async () => {
    const response = await SELF.fetch("https://vision.test/api/unknown");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.clone().text()).resolves.not.toContain("stack");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "NOT_FOUND",
        message: "API route not found.",
        requestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      },
    });
  });

  it("preserves an error envelope when its injected logger fails", async () => {
    const app = createApp({
      createRequestId: () => "req_test",
      logger: () => {
        throw new Error("logger unavailable");
      },
    });

    const response = await app.fetch(new Request("https://vision.test/api/unknown"), {} as Env);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "API route not found.", requestId: "req_test" },
    });
  });

  it("delegates non-API requests to static assets", async () => {
    const assets = { fetch: vi.fn().mockResolvedValue(new Response("shell")) };
    const app = createApp({ createRequestId: () => "req_test", logger: vi.fn() });

    const response = await app.fetch(new Request("https://vision.test/"), { ASSETS: assets } as unknown as Env);

    expect(await response.text()).toBe("shell");
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });
});
