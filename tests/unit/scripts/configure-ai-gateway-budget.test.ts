import { describe, expect, it, vi } from "vitest";
import {
  AI_GATEWAY_LIMIT_DOLLARS,
  AI_GATEWAY_WINDOW_SECONDS,
  classifyAiGatewayBudgetError,
  configureAiGatewayBudget,
  parseAiGatewayBudgetCommand,
  verifyAiGatewayBudget,
} from "../../../scripts/configure-ai-gateway-budget";

describe("preview AI Gateway budget configuration", () => {
  it("selects the read-only verifier only through one exact command flag", () => {
    expect(parseAiGatewayBudgetCommand([])).toBe("configure");
    expect(parseAiGatewayBudgetCommand(["--verify-only"])).toBe("verify");
    for (const invalid of [
      ["--verify"],
      ["--verify-only", "--verify-only"],
      ["--configure"],
    ]) {
      expect(() => parseAiGatewayBudgetCommand(invalid)).toThrow(
        "AI Gateway command is invalid.",
      );
    }
  });

  it("verifies the exact rule with list and detail reads only", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, result: [{ id: "vision-preview" }] }))
      .mockResolvedValueOnce(Response.json({
        success: true,
        result: { spend_limits: { enabled: true, rules: [{ enabled: true, limit: 9.5, limitType: "cost", technique: "fixed", window: 2_592_000 }] } },
      }));

    await expect(verifyAiGatewayBudget({ accountId: "a".repeat(32), apiToken: "private-token-that-is-never-returned" }, fetchImplementation)).resolves.toMatchObject({ configured: true });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls.map((call) => call[1]?.method ?? "GET")).toEqual(["GET", "GET"]);
  });
  it("applies and verifies one global fixed 30-day $9.50 cost rule", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [
            { id: "vision-preview", name: "Private preview gateway" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            spend_limits: {
              enabled: false,
              rules: [],
            },
          },
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
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    const update = fetchImplementation.mock.calls[2]!;
    expect(String(update[0])).toMatch(
      /\/ai-gateway\/gateways\/vision-preview$/u,
    );
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

  it("accepts an already exact rule using read-only verification", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [{ id: "vision-preview", name: "vision-preview" }],
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

    await expect(
      configureAiGatewayBudget(
        {
          accountId: "9".repeat(32),
          apiToken: "private-token-that-is-never-returned",
        },
        fetchImplementation,
      ),
    ).resolves.toMatchObject({
      configured: true,
      global: true,
      limitDollars: 9.5,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(fetchImplementation.mock.calls[1]![1]).toEqual({
      headers: {
        authorization: "Bearer private-token-that-is-never-returned",
        "content-type": "application/json",
      },
    });
  });

  it("fails closed when Cloudflare does not return the exact global rule", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [
            { id: "private-preview-gateway-id", name: "vision-preview" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            spend_limits: {
              enabled: false,
              rules: [],
            },
          },
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
        new Error("AI Gateway lookup authorization failed."),
      ),
    ).toBe("lookup_unauthorized");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway was not found."),
      ),
    ).toBe("lookup_not_found");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway list was empty."),
      ),
    ).toBe("lookup_empty");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway identity did not match."),
      ),
    ).toBe("lookup_identity_mismatch");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway update failed."),
      ),
    ).toBe("update_failed");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway update authorization failed."),
      ),
    ).toBe("update_unauthorized");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway update request was invalid."),
      ),
    ).toBe("update_invalid_request");
    expect(
      classifyAiGatewayBudgetError(
        new Error("AI Gateway update target was not found."),
      ),
    ).toBe("update_not_found");
    expect(classifyAiGatewayBudgetError(new Error("private response"))).toBe(
      "unknown_failure",
    );
  });

  it("fails closed when a nonempty Gateway list has no approved identity", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        success: true,
        result: [{ id: "other-private-id", name: "other-gateway" }],
      }),
    );

    await expect(
      configureAiGatewayBudget(
        {
          accountId: "d".repeat(32),
          apiToken: "private-token-that-is-never-returned",
        },
        fetchImplementation,
      ),
    ).rejects.toThrow("AI Gateway identity did not match.");
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("distinguishes an empty Gateway list without exposing provider data", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({
        success: true,
        result: [],
      }),
    );

    await expect(
      configureAiGatewayBudget(
        {
          accountId: "e".repeat(32),
          apiToken: "private-token-that-is-never-returned",
        },
        fetchImplementation,
      ),
    ).rejects.toThrow("AI Gateway list was empty.");
  });

  it("classifies an authorization rejection before reading provider content", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response("private provider content", { status: 403 }),
    );

    await expect(
      configureAiGatewayBudget(
        {
          accountId: "c".repeat(32),
          apiToken: "private-token-that-is-never-returned",
        },
        fetchImplementation,
      ),
    ).rejects.toThrow("AI Gateway lookup authorization failed.");
  });

  it.each([
    [403, "AI Gateway update authorization failed."],
    [422, "AI Gateway update request was invalid."],
    [404, "AI Gateway update target was not found."],
  ])(
    "classifies update status %i without reading provider content",
    async (status, expectedMessage) => {
      const rejectedUpdate = new Response("private provider content", {
        status,
      });
      const cancel = vi.spyOn(rejectedUpdate.body!, "cancel");
      const fetchImplementation = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            result: [{ id: "vision-preview", name: "vision-preview" }],
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            success: true,
            result: {
              spend_limits: {
                enabled: false,
                rules: [],
              },
            },
          }),
        )
        .mockResolvedValueOnce(rejectedUpdate);

      await expect(
        configureAiGatewayBudget(
          {
            accountId: "f".repeat(32),
            apiToken: "private-token-that-is-never-returned",
          },
          fetchImplementation,
        ),
      ).rejects.toThrow(expectedMessage);
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
});
