# privacy-safe-git-remote

Provides the sole permanent remote-tip and exact-push boundary for the Phase B
branch. It fixes the remote and ref internally, uses `execFile` argument arrays,
captures both streams, and collapses every failure to a constant error.

## `runPrivacySafeGitRemote`

Snapshots an exact variant before child work. `assert_tip` compares the single
parsed tip with `expectedCommit`. `push_exact` first proves `expectedParent`,
pushes only `HEAD` to the fixed ref, re-resolves, and proves `expectedCommit`.
The frozen success object contains only two positive booleans.

## `runPrivacySafeGitRemoteCli`

Maps the two positional CLI protocols to the programmatic adapter. It writes
only `True` plus a newline or the constant safe failure plus a newline.

## `createPrivacySafeGitRemoteSubprocessDependencies`

Returns the production dependency backed by the captured Git command runner.

## `readRemoteTip`

Runs the fixed `ls-remote --heads origin` query and requires exactly one
canonical lowercase 40-hex row for the allowlisted ref, with at most one line
terminator.

## `runCaptured`

Requires an exact `{ exitCode, stdout, stderr }` response, zero exit, string
streams, and bounded byte sizes. No child content is forwarded or placed in an
error.

## `readOperation`

Rejects accessors, prototype-bearing records, extra keys, alternate branches,
and noncanonical commits before invoking a dependency.

## `parseCliArguments`

Accepts the exact cleanup-plan sequences for `assert_tip` and `push_exact`; it
does not accept a remote URL argument or aliases.

## `runCapturedGitCommand`

Uses `execFile` with a hidden window, UTF-8 capture, a fixed buffer ceiling,
and no shell. Nonzero and synchronous failures are represented only by a
closed command result for the outer privacy boundary.

## `exactRecord`

Requires `Object.prototype` or a null prototype, optional exact keys, and own
enumerable data descriptors.

## `ownData`

Reads one own enumerable data descriptor and rejects getters or setters.

## `canonicalCommit`

Requires the full lowercase hexadecimal 40-character grammar.

## `escapeRegExp`

Escapes the internally fixed ref before constructing the exact tip parser.

## `fail`

Throws only `Privacy-safe Git operation failed.`.

## `main`

Combines frozen CLI parsing with the production captured dependency and writes
only the approved success or failure line.

## `writeStdout`

Forwards only the already-admitted `True` line to process stdout.

## `writeStderr`

Forwards only the constant adapter failure to process stderr.
