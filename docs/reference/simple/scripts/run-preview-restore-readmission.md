# run-preview-restore-readmission

Privately rechecks the same-commit role-probe rollback closure immediately
before a restore candidate. Child stdout and stderr stay captured; the command
prints neither provider metadata nor lifecycle identifiers.

## `readmitPreviewRestore`

Reads the exact closure run and jobs, downloads its closed proof, applies the
existing lifecycle validators, and returns only `{ admission: "verified" }`.
The proof must fit within 8,192 UTF-8 bytes before decoding or JSON parsing.
Any failure becomes one fixed safe error after temporary files are removed
exactly once.

## `MAX_CLOSURE_PROOF_BYTES`

Sets the closure-proof artifact limit to 8,192 bytes.

## `runCommand`

Runs one metadata command with argument arrays and captured streams.

## `makeTemporaryDirectory`

Creates the private workspace for the downloaded proof.

## `readFile`

Returns at most 8,193 raw bytes from the downloaded proof without printing or
decoding it.

## `removeTemporaryDirectory`

Removes the private proof workspace before success or failure returns.

## `createPreviewRestoreReadmissionDependencies`

Builds the production file and argument-array command boundary with bounded
captured streams, a bounded file-handle read, and no shell.

## `readBoundedClosureProof`

Reads at most the proof limit plus one byte so overflow is detected before
UTF-8 decoding.

## `validateInput`

Requires one safe repository name, two positive run references, and one full
lowercase reviewed commit before any child starts.

## `parseCapturedJson`

Parses captured JSON without forwarding either child stream.

## `validateCapturedResult`

Requires string stdout and stderr within the fixed byte ceiling.

## `parseArguments`

Accepts exactly the repository, candidate reference, closure reference, and
reviewed commit flag pairs.

## `main`

Runs the private re-admission and sets only the exit status. Both streams stay
empty on success and failure.

## `fail`

Throws the sole value-free re-admission error.
