import { describe, expect, it } from "vitest";
import {
  supervisePreviewTail,
  type PreviewTailChildCommand,
} from "../../../scripts/run-preview-tail-supervisor";

const node = (source: string): PreviewTailChildCommand =>
  Object.freeze({
    executable: process.execPath,
    arguments: Object.freeze(["-e", source]),
  });

const acceptingConsumer = (delay = 0): PreviewTailChildCommand =>
  node(
    `process.stdin.once("data",()=>setTimeout(()=>{process.stdout.write("accepted\\n");process.exit(0)},${delay}));`,
  );

describe("preview tail producer supervision", () => {
  it.each([
    ["immediate signal", 0],
    ["full uniqueness close", 40],
  ])("treats %s consumer success and deliberate producer termination as success", async (_label, delay) => {
    const result = await supervisePreviewTail({
      producer: node(
        `process.stdout.write("{}\\n");setInterval(()=>{},1000);process.on("SIGTERM",()=>process.exit(0));`,
      ),
      consumer: acceptingConsumer(delay),
    });
    expect(result).toEqual({
      stdout: "accepted\n",
      producerTermination: "deliberate",
    });
  });

  it.each([
    [
      "premature producer exit",
      node("process.exit(0)"),
      acceptingConsumer(),
    ],
    [
      "malformed observer input",
      node(`process.stdout.write("malformed\\n");setInterval(()=>{},1000);`),
      node(`process.stdin.once("data",()=>process.exit(1));`),
    ],
    [
      "producer nonzero",
      node("process.exit(7)"),
      acceptingConsumer(),
    ],
  ])("fails closed for %s without exposing child output", async (_label, producer, consumer) => {
    await expect(
      supervisePreviewTail({ producer, consumer }),
    ).rejects.toThrow("Preview tail supervision failed closed.");
  });
});
