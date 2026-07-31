import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefaultPreviewTailCommandPlan,
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

async function runSupervisorCli(
  mode: "success" | "producer_failure" | "consumer_failure",
): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "preview-supervisor-cli-"));
  const shim = join(directory, "fake-pnpm.cjs");
  const source = `
const mode=process.env.PREVIEW_SUPERVISOR_FIXTURE_MODE;
const producer=process.argv.includes("wrangler");
if(producer){
  if(mode==="producer_failure"){process.stderr.write("SECRET_CLI_CANARY");process.exit(7);}
  process.stdout.write("{}\\n");
  setInterval(()=>{},1000);
  process.on("SIGTERM",()=>process.exit(0));
}else{
  if(mode==="consumer_failure"){process.stderr.write("SECRET_CLI_CANARY");process.exit(9);}
  process.stdin.once("data",()=>{process.stderr.write("SECRET_CLI_CANARY");process.stdout.write("accepted\\n");process.exit(0);});
}`;
  await writeFile(shim, source, "utf8");
  try {
    const environment = { ...process.env };
    environment.NODE_ENV = "test";
    environment.PREVIEW_TAIL_TEST_EXECUTABLE = process.execPath;
    environment.PREVIEW_TAIL_TEST_SCRIPT = shim;
    environment.PREVIEW_SUPERVISOR_FIXTURE_MODE = mode;
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve(process.cwd(), "scripts", "run-preview-tail-supervisor.ts"),
        "--foundation-probe-only",
        "--expectation",
        "foundation_succeeded",
      ],
      {
        cwd: process.cwd(),
        env: environment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const [exitCode] = (await once(child, "close")) as [number | null];
    return { exitCode, stdout, stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("preview tail producer supervision", () => {
  it("builds shell-free default commands from installed entrypoints", () => {
    const forwarded = [
      "--expectation",
      "foundation_succeeded&still-one-argument",
    ];
    const plan = createDefaultPreviewTailCommandPlan(forwarded);

    expect(plan.producer.executable).toBe(process.execPath);
    expect(plan.consumer.executable).toBe(process.execPath);
    expect(plan.producer.arguments[0]).toMatch(/wrangler[\\/]bin[\\/]wrangler\.js$/u);
    expect(plan.producer.arguments.slice(1)).toEqual([
      "tail",
      "vision-preview",
      "--format",
      "json",
    ]);
    expect(isAbsolute(plan.producer.arguments[0]!)).toBe(true);
    expect(isAbsolute(plan.consumer.arguments[0]!)).toBe(true);
    expect(isAbsolute(plan.consumer.arguments[1]!)).toBe(true);
    expect(plan.consumer.arguments.slice(2)).toEqual(forwarded);
    expect(JSON.stringify(plan)).not.toMatch(/(?:pnpm\.cmd|cmd\.exe|shell)/iu);
  });

  it.each([
    ["success", 0, "accepted\n"],
    ["producer_failure", 1, ""],
    ["consumer_failure", 1, ""],
  ] as const)(
    "keeps actual CLI %s child streams private and returns the expected exit",
    async (mode, exitCode, stdout) => {
      const result = await runSupervisorCli(mode);
      expect(result).toEqual({ exitCode, stdout, stderr: "" });
      expect(JSON.stringify(result)).not.toContain("SECRET_CLI_CANARY");
    },
  );

  it("validates both command arrays before starting either child", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preview-supervisor-"));
    const marker = join(directory, "producer-started");
    try {
      expect(() =>
        supervisePreviewTail({
          producer: node(
            `require("node:fs").writeFileSync(${JSON.stringify(marker)},"started");`,
          ),
          consumer: {
            executable: "",
            arguments: [],
          },
        }),
      ).toThrow("Preview tail supervision failed closed.");
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      await expect(readFile(marker, "utf8")).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("waits for producer termination after an early consumer failure", async () => {
    let markExitComplete: () => void = () => undefined;
    const exitComplete = new Promise<void>((resolvePromise) => {
      markExitComplete = resolvePromise;
    });
    let releaseExitCompletion: () => void = () => undefined;
    const exitCompletionGate = new Promise<void>((resolvePromise) => {
      releaseExitCompletion = resolvePromise;
    });
    let settled = false;
    const supervision = supervisePreviewTail(
      {
        producer: node("setInterval(()=>{},1000)"),
        consumer: node("setTimeout(()=>process.exit(9),100)"),
      },
      {
        waitForChildClose: async (child) => {
          if (child.exitCode === null && child.signalCode === null) {
            await once(child, "close");
          }
          markExitComplete();
          await exitCompletionGate;
        },
      },
    );
    const settlement = supervision.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await exitComplete;
    expect(settled).toBe(false);
    releaseExitCompletion();
    await expect(supervision).rejects.toThrow(
      "Preview tail supervision failed closed.",
    );
    await settlement;
    expect(settled).toBe(true);
  });

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
