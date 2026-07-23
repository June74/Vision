/** Configures isolated Node and Cloudflare Worker test projects for Vision. */
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        test: {
          environment: "node",
          include: ["tests/contract/**/*.test.ts"],
          name: "contract",
        },
      },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: {
          include: ["tests/worker/**/*.test.ts"],
          name: "worker",
        },
      },
    ],
  },
});
