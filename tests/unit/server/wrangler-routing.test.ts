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
          r2_buckets?: Array<{
            binding?: string;
            bucket_name?: string;
          }>;
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
      expect(config.env?.[environment].vars?.BACKUP_KEY_VERSION).toBe("1");
      expect(config.env?.[environment].vars).not.toHaveProperty(
        "BACKUP_ENCRYPTION_KEY",
      );
    }

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
    expect(previewWorkflow).toContain("--env preview");
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
          BACKUP_KEY_VERSION: "1",
        },
        r2_buckets: [
          {
            binding: "BACKUP_BUCKET",
            bucket_name: "vision-preview-backups",
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validate({
        targetEnvironment: "preview",
        vars: { VISION_ENV: "preview", BACKUP_KEY_VERSION: "1" },
        r2_buckets: [],
      }),
    ).toThrow(/preview deployment configuration/i);
  });
});
