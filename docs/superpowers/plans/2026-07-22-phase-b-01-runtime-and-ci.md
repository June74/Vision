# Vision Phase B Runtime and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a strict TypeScript Cloudflare application that serves a React shell and a testable health API with repeatable CI and preview deployment.

**Architecture:** Vite builds the client and Cloudflare Worker together; Hono owns `/api/*`, while the Worker asset binding serves the single-page application. Runtime bindings are validated once and passed through typed application context.

**Tech Stack:** TypeScript, React, Vite, Hono, Cloudflare Vite plugin, Vitest 4.1+, Workers Vitest integration, Playwright, pnpm, Wrangler, GitHub Actions.

## Global Constraints

- Use one deployable repository and strict TypeScript.
- Keep provider and database credentials out of client bundles and Git.
- Use pnpm and commit `pnpm-lock.yaml`.
- Run Worker tests in the workerd-compatible Workers test pool.
- Production deployment requires manual approval; pull requests receive checks and previews only.
- Do not provision paid resources or production secrets without explicit approval.

---

### Task 1: Scaffold the Worker and React shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`
- Create: `src/server/env.ts`
- Create: `src/worker.ts`
- Create: `worker-configuration.d.ts`
- Modify: `.gitignore`
- Test: `tests/unit/server/env.test.ts`

**Interfaces:**
- Produces: `type Env` containing typed Worker bindings.
- Produces: default Worker export from `src/worker.ts`.
- Produces: `GET /api/health -> { status: "ok"; service: "vision" }`.

- [ ] **Step 1: Initialize the package and install the approved runtime**

Run:

```powershell
pnpm init
pnpm add react react-dom hono zod
pnpm add -D typescript vite vitest@^4.1.0 @vitejs/plugin-react @cloudflare/vite-plugin wrangler @cloudflare/workers-types @types/react @types/react-dom
```

Expected: `package.json` and `pnpm-lock.yaml` exist, and pnpm exits `0`.

- [ ] **Step 2: Write the failing environment contract test**

Create `tests/unit/server/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RuntimeEnvSchema } from "../../../src/server/env";

describe("RuntimeEnvSchema", () => {
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });
});
```

Run: `pnpm exec vitest run tests/unit/server/env.test.ts`

Expected: FAIL because `src/server/env.ts` does not exist.

- [ ] **Step 3: Add strict configuration and the minimal application**

Set package scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run --project unit",
    "test:worker": "vitest run --project worker",
    "test:e2e": "playwright test",
    "check": "pnpm typecheck && pnpm test:unit && pnpm test:worker && pnpm build"
  }
}
```

Create `src/server/env.ts`:

```ts
import { z } from "zod";

export const RuntimeEnvSchema = z.object({
  VISION_ENV: z.enum(["local", "preview", "production"]),
});

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
}
```

Create `src/worker.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./server/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok", service: "vision" } as const));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

Create a minimal `App.tsx` that renders `Vision` and `Foundation status`, then mount it from `main.tsx`. Configure `vite.config.ts` with `react()` and `cloudflare()`, configure `wrangler.jsonc` with `main: "src/worker.ts"`, `compatibility_date: "2026-07-22"`, SPA asset handling, `VISION_ENV: "local"`, and generated Worker types.

- [ ] **Step 4: Verify the focused contract and build**

Run:

```powershell
pnpm exec vitest run tests/unit/server/env.test.ts
pnpm typecheck
pnpm build
```

Expected: all commands exit `0`; Vite emits the Worker and client asset bundle.

- [ ] **Step 5: Commit the scaffold**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts wrangler.jsonc index.html src worker-configuration.d.ts tests/unit/server/env.test.ts .gitignore
git commit -m "build: scaffold Vision Worker application"
```

### Task 2: Add Worker-runtime and browser smoke tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/tsconfig.json`
- Create: `tests/worker/health.test.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/shell.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: default Worker export and `/api/health` from Task 1.
- Produces: repeatable `unit`, `worker`, and `e2e` test projects.

- [ ] **Step 1: Install the approved test runtime**

Run:

```powershell
pnpm add -D @cloudflare/vitest-pool-workers @playwright/test
pnpm exec playwright install chromium
```

Expected: pnpm exits `0`; Chromium is available to Playwright.

- [ ] **Step 2: Write the failing Worker health test**

Create `tests/worker/health.test.ts`:

```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Vision Worker", () => {
  it("reports a healthy API", async () => {
    const response = await SELF.fetch("https://vision.test/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "vision" });
  });
});
```

Run: `pnpm test:worker`

Expected: FAIL because the Worker test project is not configured.

- [ ] **Step 3: Configure Vitest and Playwright**

Create a `unit` Vitest project using Node and a `worker` project using:

```ts
cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })
```

Set `tests/tsconfig.json` types to `vitest/globals` and `@cloudflare/vitest-pool-workers`. Configure Playwright to start `pnpm dev --host 127.0.0.1`, use Chromium, and target `http://127.0.0.1:5173`.

Create `tests/e2e/shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("shows the Vision foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vision" })).toBeVisible();
  await expect(page.getByText("Foundation status")).toBeVisible();
});
```

- [ ] **Step 4: Run each real entry point**

Run:

```powershell
pnpm test:unit
pnpm test:worker
pnpm test:e2e
pnpm build
```

Expected: each command exits `0`; the browser test confirms the rendered shell, not only bundle structure.

- [ ] **Step 5: Commit the test harness**

```powershell
git add package.json pnpm-lock.yaml vitest.config.ts playwright.config.ts tests
git commit -m "test: add Worker and browser smoke coverage"
```

### Task 3: Add privacy-safe request logging and error envelopes

**Files:**
- Create: `src/server/errors.ts`
- Create: `src/server/request-context.ts`
- Create: `src/server/logging.ts`
- Modify: `src/worker.ts`
- Test: `tests/unit/server/logging.test.ts`
- Test: `tests/worker/errors.test.ts`

**Interfaces:**
- Produces: `VisionError { code; status; safeMessage }`.
- Produces: `logEvent(logger, { requestId, action, outcome, errorCategory? })`.
- Produces: response envelope `{ error: { code; message; requestId } }`.

- [ ] **Step 1: Write tests that reject sensitive log fields**

```ts
expect(() => logEvent(logger, {
  requestId: "req_1",
  action: "calendar.sync",
  outcome: "failed",
  description: "private text",
} as never)).toThrow("Unsupported audit field");
```

Add a Worker test asserting an unknown API route returns a JSON error with an opaque request ID and no stack trace.

Run: `pnpm exec vitest run tests/unit/server/logging.test.ts tests/worker/errors.test.ts`

Expected: FAIL because the logging and error modules do not exist.

- [ ] **Step 2: Implement the allowlisted logger and error middleware**

Define `SafeLogEventSchema` with only `requestId`, `action`, `outcome`, `errorCategory`, `durationMs`, `provider`, `retryCount`, and opaque entity IDs. Parse before calling the injected logger. Add Hono middleware that assigns `crypto.randomUUID()`, converts expected `VisionError` values to JSON, maps unknown errors to `INTERNAL_ERROR`, and logs only the safe category.

- [ ] **Step 3: Verify focused and regression tests**

Run: `pnpm exec vitest run tests/unit/server/logging.test.ts tests/worker/errors.test.ts && pnpm check`

Expected: all tests and build pass; sensitive fields are rejected.

- [ ] **Step 4: Commit the server safety envelope**

```powershell
git add src/server src/worker.ts tests/unit/server tests/worker
git commit -m "feat: add privacy-safe server envelopes"
```

### Task 4: Add continuous integration and guarded previews

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/preview.yml`
- Create: `.github/workflows/production.yml`
- Create: `docs/operations/environments.md`
- Create: `docs/operations/secrets.md`
- Modify: `package.json`

**Interfaces:**
- Produces: required `check` workflow for pull requests.
- Produces: preview deployment that does not use production secrets.
- Produces: manually dispatched production deployment protected by GitHub environment approval.

- [ ] **Step 1: Add a workflow-policy test**

Create `tests/unit/ci/workflows.test.ts` that reads the three YAML files and asserts:

```ts
expect(ci).toContain("pnpm check");
expect(preview).not.toContain("production");
expect(production).toContain("workflow_dispatch");
expect(production).toContain("environment: production");
```

Run: `pnpm exec vitest run tests/unit/ci/workflows.test.ts`

Expected: FAIL because workflows do not exist.

- [ ] **Step 2: Implement CI and deployment workflows**

Use `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` with pnpm cache, `pnpm install --frozen-lockfile`, and `pnpm check`. Preview uses a non-production Cloudflare environment. Production is `workflow_dispatch` only and references the protected GitHub `production` environment. Do not embed account IDs or tokens in YAML.

Document each secret by name, owner, environment, rotation trigger, and whether it is allowed in preview. Explicitly prohibit `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`, and key-encryption secrets from client-prefixed Vite variables.

- [ ] **Step 3: Verify workflows locally**

Run:

```powershell
pnpm exec vitest run tests/unit/ci/workflows.test.ts
pnpm check
git diff --check
```

Expected: all commands exit `0` and the test proves production remains manually gated.

- [ ] **Step 4: Commit CI**

```powershell
git add .github package.json docs/operations tests/unit/ci
git commit -m "ci: add guarded Vision delivery pipeline"
```

## Milestone verification

Run:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
git diff --check
```

Expected: clean install and all checks pass. After user approval to create a preview, open the preview URL, confirm the `Vision` shell renders, and request `/api/health`; record both results before calling this milestone complete.
