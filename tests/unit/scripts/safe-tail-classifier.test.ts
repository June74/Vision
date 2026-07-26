import { describe, expect, it } from "vitest";
import {
  classifySafeTailLine,
  createSafeTailAccumulator,
} from "../../../scripts/safe-tail-classifier";

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

  it("assembles Wrangler's multiline JSON without exposing raw fields", () => {
    const accumulator = createSafeTailAccumulator();
    const lines = JSON.stringify(
      {
        outcome: "exception",
        event: { cron: "* * * * *" },
        exceptions: [
          { message: "Backup verification failed. private-object-key" },
        ],
      },
      null,
      4,
    ).split("\n");

    for (const line of lines.slice(0, -1)) {
      expect(accumulator.push(line)).toBeNull();
    }
    const evidence = accumulator.push(lines.at(-1) ?? "");
    expect(evidence).toEqual({
      category: "backup_verification_failed",
      cron: "temporary_recovery",
      outcome: "exception",
    });
    expect(JSON.stringify(evidence)).not.toContain("private-object-key");
  });
});
