import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../src/worker";
import { consumer } from "../../src/jobs/queue-consumer";
import { scheduled } from "../../src/jobs/scheduled";

describe("Vision Worker", () => {
  it("retains the real queue and scheduled handlers when auth diagnostics are integrated", () => {
    expect(worker.queue).toBe(consumer);
    expect(worker.scheduled).toBe(scheduled);
    expect(worker.fetch).toBeTypeOf("function");
  });

  it("reports a healthy API", async () => {
    const response = await SELF.fetch("https://vision.test/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "vision" });
  });
});
