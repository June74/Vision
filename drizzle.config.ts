/** Configures Drizzle Kit to generate disposable drafts beside the reviewed SQL migration. */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/data/schema/index.ts",
  out: "./migrations/generated",
});
