/** Serves the Vision API and delegates browser routes to static assets. */
import { Hono } from "hono";
import type { Env } from "./server/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok", service: "vision" } as const));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
