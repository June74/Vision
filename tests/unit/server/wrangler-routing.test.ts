/** Locks Cloudflare's SPA routing so browser navigation cannot bypass Vision API handlers. */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Cloudflare asset routing", () => {
  it("runs the Worker before SPA fallback for every API route", async () => {
    const config = JSON.parse(
      await readFile(new URL("../../../wrangler.jsonc", import.meta.url), "utf8"),
    ) as {
      assets?: {
        run_worker_first?: string[];
      };
      queues?: {
        producers?: Array<{ binding?: string; queue?: string }>;
        consumers?: Array<{
          queue?: string;
          max_retries?: number;
          max_concurrency?: number;
        }>;
      };
      triggers?: { crons?: string[] };
      r2_buckets?: Array<{
        binding?: string;
        bucket_name?: string;
      }>;
      vars?: Record<string, string>;
      env?: Record<
        "preview" | "production",
        {
          queues?: {
            producers?: Array<{ binding?: string; queue?: string }>;
            consumers?: Array<{
              queue?: string;
              max_retries?: number;
              max_concurrency?: number;
            }>;
          };
          r2_buckets?: Array<{
            binding?: string;
            bucket_name?: string;
          }>;
          triggers?: { crons?: string[] };
          vars?: Record<string, string>;
        }
      >;
    };

    expect(config.assets?.run_worker_first).toEqual([
      "/api/*",
      "/webhooks/google/calendar",
    ]);
    expect(config.queues?.producers).toEqual([
      {
        binding: "CALENDAR_SYNC_QUEUE",
        queue: "vision-calendar-sync",
      },
    ]);
    expect(config.queues?.consumers).toEqual([
      expect.objectContaining({
        queue: "vision-calendar-sync",
        max_retries: 5,
        max_concurrency: 1,
      }),
    ]);
    expect(config.triggers?.crons).toEqual([
      "*/15 * * * *",
      "5 6 * * *",
    ]);
    expect(config.env?.preview.triggers?.crons).toEqual([
      "*/15 * * * *",
      "5 6 * * *",
      "* * * * *",
    ]);
    expect(config.env?.production.triggers?.crons).toEqual([
      "*/15 * * * *",
      "5 6 * * *",
    ]);
    expect(config.r2_buckets).toBeUndefined();
    expect(config.env?.preview.r2_buckets).toEqual([
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-preview-backups",
      },
    ]);
    expect(config.env?.production.r2_buckets).toEqual([
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-production-backups",
      },
    ]);
    expect(config.env?.preview.r2_buckets?.[0]?.bucket_name).not.toBe(
      config.env?.production.r2_buckets?.[0]?.bucket_name,
    );
    for (const environment of ["preview", "production"] as const) {
      expect(config.env?.[environment].queues).toEqual(config.queues);
      expect(config.env?.[environment].vars?.BACKUP_KEY_VERSION).toBe("1");
      expect(config.env?.[environment].vars).not.toHaveProperty(
        "BACKUP_ENCRYPTION_KEY",
      );
    }
    expect(
      config.env?.preview.vars?.GOOGLE_REDIRECT_URI ===
        "https://vision-preview.june74.workers.dev/api/auth/google/callback",
    ).toBe(true);

    const [previewWorkflow, productionWorkflow] = await Promise.all([
      readFile(
        new URL("../../../.github/workflows/preview.yml", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../../../.github/workflows/production.yml", import.meta.url),
        "utf8",
      ),
    ]);
    expect(previewWorkflow.includes("--env preview")).toBe(false);
    expect(previewWorkflow.includes("--var ")).toBe(false);
    expect(previewWorkflow).toContain("configure_ai_budget:");
    expect(previewWorkflow).toContain(
      "pnpm gateway:configure:preview",
    );
    expect(previewWorkflow).toMatch(
      /Print only allowlisted scheduled evidence[\s\S]*?set \+o pipefail[\s\S]*?timeout 85s/u,
    );
    expect(previewWorkflow).toMatch(
      /Build deployable preview artifact[\s\S]*?env:\s*\n\s+CLOUDFLARE_ENV: preview/u,
    );
    expect(previewWorkflow).toContain("pnpm deploy:check:preview");
    expect(productionWorkflow).toContain("--env production");
  });

  it("accepts only a generated preview artifact with the preview backup binding", async () => {
    const validationModule = await import(
      "../../../scripts/validate-preview-deploy-config"
    );
    const validate = Reflect.get(
      validationModule,
      "validatePreviewDeployConfig",
    ) as ((candidate: unknown) => void) | undefined;
    expect(validate).toBeTypeOf("function");
    if (!validate) return;

    expect(() =>
      validate({
        targetEnvironment: "preview",
        vars: {
          VISION_ENV: "preview",
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          BACKUP_KEY_VERSION: "1",
          GOOGLE_REDIRECT_URI:
            "https://vision-preview.june74.workers.dev/api/auth/google/callback",
        },
        queues: {
          producers: [
            {
              binding: "CALENDAR_SYNC_QUEUE",
              queue: "vision-calendar-sync",
            },
          ],
          consumers: [
            {
              queue: "vision-calendar-sync",
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
        triggers: {
          crons: ["*/15 * * * *", "5 6 * * *", "* * * * *"],
        },
        r2_buckets: [
          {
            binding: "BACKUP_BUCKET",
            bucket_name: "vision-preview-backups",
          },
        ],
      }),
    ).not.toThrow();
    for (const crons of [
      ["*/15 * * * *", "5 6 * * *"],
      ["*/15 * * * *", "5 6 * * *", "0 * * * *"],
      ["*/15 * * * *", "5 6 * * *", "* * * * *", "0 0 * * *"],
    ]) {
      expect(() =>
        validate({
          targetEnvironment: "preview",
          vars: {
            VISION_ENV: "preview",
            AI_MONTHLY_HARD_LIMIT_CENTS: "950",
            BACKUP_KEY_VERSION: "1",
            GOOGLE_REDIRECT_URI:
              "https://vision-preview.vision-calendar.workers.dev/api/auth/google/callback",
          },
          queues: {
            producers: [
              {
                binding: "CALENDAR_SYNC_QUEUE",
                queue: "vision-calendar-sync",
              },
            ],
            consumers: [
              {
                queue: "vision-calendar-sync",
                max_batch_size: 10,
                max_batch_timeout: 5,
                max_retries: 5,
                max_concurrency: 1,
              },
            ],
          },
          triggers: { crons },
          r2_buckets: [
            {
              binding: "BACKUP_BUCKET",
              bucket_name: "vision-preview-backups",
            },
          ],
        }),
      ).toThrow(/preview deployment configuration/i);
    }
    expect(() =>
      validate({
        targetEnvironment: "production",
        vars: {
          VISION_ENV: "production",
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          BACKUP_KEY_VERSION: "1",
          GOOGLE_REDIRECT_URI:
            "https://vision-preview.vision-calendar.workers.dev/api/auth/google/callback",
        },
        queues: {
          producers: [
            {
              binding: "CALENDAR_SYNC_QUEUE",
              queue: "vision-calendar-sync",
            },
          ],
          consumers: [
            {
              queue: "vision-calendar-sync",
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
        triggers: {
          crons: ["*/15 * * * *", "5 6 * * *", "* * * * *"],
        },
        r2_buckets: [
          {
            binding: "BACKUP_BUCKET",
            bucket_name: "vision-preview-backups",
          },
        ],
      }),
    ).toThrow(/preview deployment configuration/i);
    expect(() =>
      validate({
        targetEnvironment: "preview",
        vars: {
          VISION_ENV: "preview",
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          BACKUP_KEY_VERSION: "1",
          GOOGLE_REDIRECT_URI:
            "https://vision-preview.june74.workers.dev/api/auth/google/callback",
        },
        queues: {
          producers: [
            {
              binding: "CALENDAR_SYNC_QUEUE",
              queue: "vision-calendar-sync",
            },
          ],
          consumers: [
            {
              queue: "vision-calendar-sync",
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
        triggers: { crons: ["*/15 * * * *", "5 6 * * *"] },
        r2_buckets: [],
      }),
    ).toThrow(/preview deployment configuration/i);
    expect(() =>
      validate({
        targetEnvironment: "preview",
        vars: {
          VISION_ENV: "preview",
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          BACKUP_KEY_VERSION: "1",
          GOOGLE_REDIRECT_URI:
            "https://vision-preview.june74.workers.dev/api/auth/google/callback",
        },
        queues: { producers: [], consumers: [] },
        triggers: { crons: ["*/15 * * * *", "5 6 * * *"] },
        r2_buckets: [
          {
            binding: "BACKUP_BUCKET",
            bucket_name: "vision-preview-backups",
          },
        ],
      }),
    ).toThrow(/preview deployment configuration/i);
    expect(() =>
      validate({
        targetEnvironment: "preview",
        vars: {
          VISION_ENV: "preview",
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          BACKUP_KEY_VERSION: "1",
          GOOGLE_REDIRECT_URI:
            "https://vision-preview.june74.workers.dev/api/auth/google/callback",
        },
        queues: {
          producers: [
            {
              binding: "CALENDAR_SYNC_QUEUE",
              queue: "vision-calendar-sync",
            },
          ],
          consumers: [
            {
              queue: "vision-calendar-sync",
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
        triggers: { crons: [] },
        r2_buckets: [
          {
            binding: "BACKUP_BUCKET",
            bucket_name: "vision-preview-backups",
          },
        ],
      }),
    ).toThrow(/preview deployment configuration/i);
  });
});
