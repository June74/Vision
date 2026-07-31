# `scripts/run-preview-restore-readmission.ts`

Implements the workflow's last-moment restore re-admission as one privacy-safe
process boundary. It replaces shell-visible metadata commands with captured
`execFile` argument arrays and reuses the canonical rollback run and closure
validators.

## `readmitPreviewRestore`

Validates the complete public input before creating a temporary directory.
It requests fixed `--jq` projections for the closure run and jobs, verifies the
successful `Close restored normal preview` job at the reviewed commit,
downloads the closure artifact with captured streams, and admits
`deploy_restore` only from the matching role-probe closure. Cleanup failure,
command failure, proof input above 8,192 bytes, invalid UTF-8, malformed JSON,
or lifecycle mismatch all collapse to the constant error. Proof size is
checked before decoding, temporary cleanup runs exactly once, and the only
returned shape is `{ admission: "verified" }`.

## `MAX_CLOSURE_PROOF_BYTES`

Defines the explicit 8,192-byte closure-proof artifact ceiling.

## `runCommand`

Represents the injected captured `executable + arguments[]` metadata process
port. Its stdout and stderr never become status or error text.

## `makeTemporaryDirectory`

Creates one isolated download directory before the first metadata request.

## `readFile`

Returns raw bytes only from the expected closure-proof path. Production reads
at most 8,193 bytes, allowing the caller to detect overflow without retaining
the rest of the file.

## `removeTemporaryDirectory`

Recursively removes the private directory in `finally`; cleanup failure turns
an otherwise valid admission into the constant failure.

## `createPreviewRestoreReadmissionDependencies`

Creates the concrete `gh` runner with UTF-8 capture, hidden child windows,
one-megabyte buffers, `shell: false`, temporary-directory creation, a
file-handle proof read capped at maximum plus one byte, and recursive cleanup.

## `readBoundedClosureProof`

Opens the proof read-only, fills one 8,193-byte buffer at most, returns the
bytes actually read, and closes the handle in `finally`. Decoding and JSON
parsing occur only after the caller rejects an over-limit result.

## `validateInput`

Requires `owner/repository`, nonzero decimal candidate and closure references
without leading zeroes, and a 40-character lowercase hexadecimal commit.

## `parseCapturedJson`

Bounds the captured response before parsing stdout as JSON and deliberately
ignores private stderr.

## `validateCapturedResult`

Awaits or accepts one command result and requires both retained streams to be
strings no larger than the fixed byte limit.

## `parseArguments`

Requires exactly four unique flag/value pairs:
`--repository`, `--candidate-run-ref`, `--closure-run-ref`, and `--commit`.
Aliases, positional values, duplicates, and baseline references fail before
metadata access.

## `main`

Runs the closed parser and admission boundary without writing output. Failure
sets exit code 1 and does not render the constant error or its cause.

## `fail`

Throws `Preview restore re-admission failed closed.` as the only public error.
