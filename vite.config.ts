/** Configures the Vision browser client and Cloudflare Worker build. */
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Returns the shared Vite configuration for the single Vision deployment. */
export default defineConfig(({ mode }) => ({
  // The Worker plugin owns its own workerd test pool; unit tests run in Node until Task 2 configures that pool.
  plugins: [react(), ...(mode === "test" ? [] : [cloudflare()])],
}));
