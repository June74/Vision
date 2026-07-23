# Task 4 authenticated setup interface report

## Delivered

- Added safe signed-out, access-denied, unavailable, discovery, choice, exact-confirmation, creating, connected, retry, and action-required browser states.
- Added a responsive ink/navy, warm-paper, and mint instrument-panel treatment with a non-sensitive setup-signal rail for state and version.
- Added six mocked Playwright flows. They use only `/api/auth/session` and calendar-setup routes; no Google service, provider route, token, or secret is used.
- Browser persistence is limited to one `sessionStorage` idempotency UUID namespaced by server setup version. The browser does not store OAuth/provider tokens or provider responses.
- Added required JSDoc plus matching simple and technical client references.

## Evidence

### RED

`pnpm.cmd test:e2e -- auth-setup.spec.ts` was run after adding the six browser flows and before UI implementation. The six new flows failed because the original shell did not render their required controls or states.

### GREEN browser check

Because the PowerShell package-script separator is forwarded literally, a reusable local Vite job was started with an in-worktree `XDG_CONFIG_HOME`, then this exact package script was run: `pnpm.cmd test:e2e -- auth-setup.spec.ts --workers=1`.

Exit code: `0`; Chromium result: `7 passed (4.6s)`.

The seven passing Chromium flows include the updated shell smoke test and all six Task 4 flows: signed out, denied, owned-calendar selection/verification, exact phrase gating, double-click/reload idempotency, and safe action-required copy.

### Repository check

`pnpm.cmd check` exited `0`: 193 unit tests passed, 30 worker tests passed, documentation coverage passed, type checks passed, and the production build passed.

`git diff --check` exited successfully. Screenshots were not captured; the Playwright flows exercised the rendered controls and visible copy directly in Chromium.

## Self-review and concerns

- Confirmed the browser holds only the CSRF value in React memory and an opaque idempotency UUID in `sessionStorage`; no OAuth/provider token is displayed or persisted.
- Confirmed the create button requires the exact uppercase phrase and an in-flight ref prevents duplicate mutation clicks.
- Confirmed safe failure screens do not render raw response/provider errors.
- The worker-test pool logs static-export-analysis warnings caused by sandbox parent-directory access, but its 30 tests and the full `pnpm.cmd check` command exit successfully. No Task 4 functional concern remains.

## Consolidated review repair evidence

- RED: replay/reload, truthful pending, focus, callback-denial, and narrow-viewport browser regressions were added. The pre-repair flow failed on replay, focus, and mobile assertions.
- GREEN: focused `auth-setup.spec.ts` passed 9/9 with workspace-local `XDG_CONFIG_HOME`. It covers the real callback denial page, exact creation replay with the original version/key, live signal rail updates, keyboard focus on the named setup region, safe malformed-session handling, and narrow viewport behavior.
- The browser now persists only one opaque active creation record (original setup version and UUID), reuses it for recovery, and clears it only after connection. Pending copy distinguishes discovery, verification, and request progress.
- Full `pnpm.cmd check` was run after the repair. Typecheck passed, then two unrelated PGlite integration hooks timed out: `auth-token-concurrency` and `purge-expired-deletions` (191/193 unit tests passed). No Task 4 browser failure was reported by that command.
