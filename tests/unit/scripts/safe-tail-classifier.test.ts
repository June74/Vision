import { describe, expect, it } from "vitest";
import { classifySafeTailLine } from "../../../scripts/safe-tail-classifier";

describe("safe Cloudflare tail classification", () => {
  it("returns only allowlisted recovery evidence", () => {
    const raw = JSON.stringify({
      outcome: "exception",
      event: {
        cron: "* * * * *",
        url: "https://private.example.test/secret",
      },
      logs: [
        {
          message: [
            "Error: Backup creation failed.",
            "Bearer private-token",
          ],
        },
      ],
    });

    expect(classifySafeTailLine(raw)).toEqual({
      category: "backup_creation_failed",
      cron: "temporary_recovery",
      outcome: "exception",
    });
    expect(JSON.stringify(classifySafeTailLine(raw))).not.toContain(
      "private",
    );
  });

  it("ignores non-json output and non-scheduled events", () => {
    expect(classifySafeTailLine("wrangler banner")).toBeNull();
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { request: { url: "https://private.example.test" } },
        }),
      ),
    ).toBeNull();
  });

  it("classifies a successful scheduled recovery without copying logs", () => {
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { cron: "5 6 * * *" },
          logs: [{ message: ["untrusted content"] }],
        }),
      ),
    ).toEqual({
      category: "none",
      cron: "daily_recovery",
      outcome: "ok",
    });
  });
});
