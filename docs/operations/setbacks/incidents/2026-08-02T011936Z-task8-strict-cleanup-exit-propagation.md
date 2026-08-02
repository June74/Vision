# Task 8 strict cleanup wrapper did not propagate the intentional failure

- **Occurred:** 2026-08-02T01:19:36.9540697Z
- **Status:** closed
- **Phase:** Phase B / tracked correlation repair / Task 8 exact-tip finding repair
- **Category:** verification wrapper exit-code error

## What happened

The strict pre-cleanup sentinel produced its expected three failures and thirteen passes, but the enclosing PowerShell script block did not propagate Vitest's nonzero exit status to the shell result.

## Impact

No project, provider, deployment, credential, key, or live state changed. The test counts confirm the expected pre-cleanup residue, but the wrapper's reported exit code is not valid evidence.

## Corrective action

- Rerun the same strict sentinel with explicit `$LASTEXITCODE` propagation.
- Require a nonzero process result plus exactly three expected failures and thirteen passes.
- Keep the strict sentinel separate from ordinary green gates.

## Prevention

Every PowerShell wrapper around an intentionally failing verifier must end with explicit exit propagation; do not infer the child result from displayed test output alone.

## Recurrence

At 2026-08-02T01:20:17.8422475Z the corrected wrapper captured the required nonzero child exit, but one combined ANSI-normalized summary expression did not recognize Vitest's rendered count line. The raw output was not accepted or reproduced; the next check validates the failure and pass counts independently after normalization.

At 2026-08-02T01:20:48.6130411Z the independent-count parser also missed both rendered counts even though the child exit remained nonzero. The next bounded diagnostic emits only sanitized test-summary words and numbers so the native wrapper's actual capture shape can be recognized safely.

## Closure

The final wrapper stripped ANSI control sequences explicitly, captured a nonzero child exit, and verified the exact three-failure and thirteen-pass sentinel shape without reproducing failure content.
