/** Configures Chromium smoke tests against Vision's local Vite server. */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:5173",
  },
});
