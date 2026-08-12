# SB-20260812-095112 — Preview validator saw the full-check local artifact

- **Status:** contained
- **Detected:** 2026-08-12T09:51:12Z
- **Area:** Phase B preview observability deployment preparation
- **Symptom:** After the full check rebuilt the artifact with its default local environment, `pnpm deploy:check:preview` rejected `dist/vision/wrangler.json` because it was not the preview artifact.
- **Impact:** No deployment or provider mutation occurred.
- **Correction:** Rebuild with `CLOUDFLARE_ENV=preview` immediately before preview validation and deployment; never infer the artifact environment from the preceding test command.

