/** Configures isolated Node and Cloudflare Worker test projects for Vision. */
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
          // PGlite starts a PostgreSQL WASM runtime per integration file; bound parallel startup
          // to keep Windows CI hooks deterministic instead of competing until their 10s timeout.
          maxWorkers: 4,
          name: "unit",
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          environment: "node",
          include: ["tests/contract/**/*.test.ts"],
          name: "contract",
          sequence: { groupOrder: 2 },
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: {
          include: ["tests/worker/**/*.test.ts"],
          name: "worker",
          sequence: { groupOrder: 3 },
        },
      },
    ],
  },
});
