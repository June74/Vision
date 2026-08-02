# Task 8 worker suite repeated local Wrangler fallback warnings

- **Occurred:** 2026-08-02T00:50:26Z
- **Status:** contained
- **Phase:** Phase B / tracked correlation repair / Task 8 complete Gate 0
- **Category:** known local sandbox warning recurrence

## What happened

The full worker suite passed, while Wrangler repeated two known local-only warnings: its optional static entrypoint analysis could not traverse a parent directory under the managed filesystem boundary, and its optional external debug-log location was not writable.

The runner used its normal fallback, created no repository debug log, and completed all worker tests successfully.

## Impact

No test failed and no product, provider, deployment, credential, or live state changed. The warning output is not acceptance evidence; the authoritative worker result was 7 files and 110 tests passed.

## Corrective action

- Preserve the passing worker result and classify the warnings separately.
- Check repository status before freeze for any generated debug-log residue.
- Continue Gate 0 serially without treating optional logging as a product failure.

## Prevention

Keep Wrangler-backed verification result counts separate from optional diagnostic-log and static-analysis warnings, and always prove no untracked log residue before freezing a candidate.

## Aggregate-check recurrence

At 2026-08-02T00:56:05.9251875Z the same optional log warning recurred in the aggregate command's worker and build portions, and the same static-analysis fallback recurred in its worker portion. The aggregate command still exited zero after all suites, documentation coverage, production build, crypto-boundary validation, and release security scan passed. Repository log-residue absence remains a required pre-freeze check.

At 2026-08-02T00:56:32.6601533Z the optional log warning recurred during the explicit preview build. The build and crypto-boundary validator exited zero; generated-artifact validation remains the authoritative next check.

At 2026-08-02T00:57:00.1378200Z it recurred during the explicit production build. That build and crypto-boundary validator also exited zero; the production generated-artifact validator remains authoritative.

At 2026-08-02T00:59:28.003Z the optional log warning recurred during the final preview artifact build. The build and crypto-boundary validator exited zero; the preview generated configuration is the next authoritative check.

At 2026-08-02T01:00:03.435Z it recurred during the final production artifact build. The build and crypto-boundary validator exited zero; the production generated configuration and deploy validator remain authoritative.

During the post-review-repair aggregate check, the worker static-analysis fallback and optional external-log warning recurred, followed by the optional log warning during the build at 2026-08-02T01:25:06.086Z. The aggregate command still exited zero after 1,730 unit, 179 contract, and 110 worker tests, documentation coverage, production build, crypto-boundary validation, and release security scan all passed. Candidate log residue remains subject to the final zero-count freeze check.

At 2026-08-02T01:25:58.152Z the optional log warning recurred during the post-repair preview build. The build and crypto-boundary validator exited zero; the generated preview configuration and deploy validator remain authoritative.

At 2026-08-02T01:26:30.707Z it recurred during the post-repair production build. The build and crypto-boundary validator exited zero; the generated production configuration and deploy validator remain authoritative.
