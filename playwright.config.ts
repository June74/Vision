/** Configures Chromium smoke tests against Vision's local Vite server. */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:5173",
  },
});
