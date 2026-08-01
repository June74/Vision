# privacy-safe-git-remote

Checks or updates the one approved Git branch without showing remote output,
commit details, command arguments, or connection information.

## `runPrivacySafeGitRemote`

Runs `assert_tip` or `push_exact` against the fixed `origin` branch. Success is
only `{ succeeded: true, exactTipMatch: true }`; every failure uses one safe
message. An exact push names the reviewed commit object directly and permits
the fixed branch update only while its remote tip still equals the reviewed
parent.

## `runPrivacySafeGitRemoteCli`

Accepts only the frozen cleanup command shapes and prints `True` on success or
the constant safe failure on stderr.

## `createPrivacySafeGitRemoteSubprocessDependencies`

Creates the real child-process boundary with argument arrays and captured
streams.

## `readRemoteTip`

Accepts exactly one lowercase 40-character commit line for the fixed branch.

## `runCaptured`

Validates child completion and bounded text while keeping both streams private.

## `readOperation`

Copies one exact operation input and rejects extra keys or alternate branches.

## `parseCliArguments`

Parses only the approved `assert_tip` and `push_exact` argument sequences.

## `runCapturedGitCommand`

Runs Git without a shell, hidden window, or inherited output.

## `exactRecord`

Requires an ordinary object with the expected own data keys.

## `ownData`

Reads a data property without invoking an accessor.

## `canonicalCommit`

Recognizes one lowercase 40-character hexadecimal commit.

## `escapeRegExp`

Escapes the fixed branch reference for exact matching.

## `fail`

Throws the adapter's only public failure message.

## `main`

Runs the permanent command-line adapter and sets its exit status.

## `writeStdout`

Writes only the admitted `True` success line.

## `writeStderr`

Writes only the constant safe failure line.
