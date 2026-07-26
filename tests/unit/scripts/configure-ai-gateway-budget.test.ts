import { describe, expect, it, vi } from "vitest";
import {
  AI_GATEWAY_LIMIT_DOLLARS,
  AI_GATEWAY_WINDOW_SECONDS,
  classifyAiGatewayBudgetError,
  configureAiGatewayBudget,
} from "../../../scripts/configure-ai-gateway-budget";

describe("preview AI Gateway budget configuration", () => {
  it("applies and verifies one global fixed 30-day $9.50 cost rule", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: { id: "vision-preview" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            spend_limits: {
              enabled: true,
              rules: [
                {
                  enabled: true,
                  limit: 9.5,
                  limitType: "cost",
                  technique: "fixed",
                  window: 2_592_000,
                },
              ],
            },
          },
        }),
      );

    const result = await configureAiGatewayBudget(
      {
        accountId: "a".repeat(32),
        apiToken: "private-token-that-is-never-returned",
      },
      fetchImplementation,
    );

    expect(result).toEqual({
      configured: true,
      global: true,
      limitDollars: 9.5,
      technique: "fixed",
      windowSeconds: 2_592_000,
    });
    expect(AI_GATEWAY_LIMIT_DOLLARS).toBe(9.5);
    expect(AI_GATEWAY_WINDOW_SECONDS).toBe(2_592_000);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const update = fetchImplementation.mock.calls[1]!;
    expect(update[1]).toMatchObject({
      method: "PUT",
      headers: {
        authorization: "Bearer private-token-that-is-never-returned",
        "content-type": "application/json",
      },
    });
    expect(JSON.parse(String(update[1]?.body))).toEqual({
      spend_limits: {
        enabled: true,
        rules: [
          {
            enabled: true,
            limit: 9.5,
            limitType: "cost",
            technique: "fixed",
            window: 2_592_000,
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain("a".repeat(32));
  });

  it("fails closed when Cloudflare does not return the exact global rule", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: { id: "vision-preview" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            spend_limits: {
              enabled: true,
              rules: [
                {
                  enabled: true,
                  limit: 9.5,
                  limitType: "cost",
                  model: { mode: "filter", values: ["private-model"] },
                  technique: "fixed",
                  window: 2_592_000,
                },
              ],
            },
          },
        }),
      );

    await expect(
      configureAiGatewayBudget(
        {
          accountId: "b".repeat(32),
          apiToken: "private-token-that-is-never-returned",
        },
        fetchImplementation,
      ),
    ).rejects.toThrow("AI Gateway budget verification failed.");
  });

  it("maps provider failures to a closed privacy-safe category", () => {
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway lookup failed."),
      ),
    ).toBe("lookup_failed");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway update failed."),
      ),
    ).toBe("update_failed");
    expect(classifyAiGatewayBudgetError(new Error("private response"))).toBe(
      "unknown_failure",
    );
  });
});
