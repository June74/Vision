# SB-20260729-184849-windows-empty-candidate-argument: Non-AI candidate CLI rejected Windows empty argument

- **Status:** closed
- **First observed:** 2026-07-29T18:48:49Z
- **Last observed:** 2026-07-29T18:48:49Z
- **Phase/task:** Phase B acceptance instrumentation Task 7
- **Environment:** Local Windows PowerShell
- **Version/commit:** `d4de4de`

## Symptom

The repository-local TypeScript wrapper reached the acceptance candidate
builder, but the foundation candidate was rejected by the generic
configuration guard before an artifact was written.

## Impact

The foundation generation result remains unverified through the CLI. No
candidate artifact, source file, provider state, or external state changed.

## Reproduction conditions

Invoke the candidate builder through the local Windows command wrapper while
passing the required empty AI-attestation value for a non-AI candidate.

## Safe evidence

The builder returned only its fixed generic invalid-configuration category.
The expected output path remained absent.

## Attempts and outcomes

- The local wrapper corrected the earlier package-runner resolution failure.
- The builder then rejected the invocation before writing its exclusive output
  path.

## Cause classification

- **Confirmed cause:** PowerShell's native-command argument transport omitted
  the empty scalar before it reached both Node and the local TypeScript wrapper,
  causing the exact flag-pair parser to reject the invocation.
- **Hypothesis:** None.
- **Rejected hypotheses:** The normal preview artifact is invalid. Its exact
  normal deploy validator passed immediately before this attempt.
- **Known exclusions:** No provider, deployment, secret, object, or repository
  mutation occurred.

## Correction and prevention

- **Correction:** Reproduce empty-argument transport with a safe argument-count
  diagnostic, then invoke the same script through Node's installed TypeScript
  loader if the wrapper is the failing boundary.
- **Prevention:** Keep candidate generation arguments exact and verify both the
  child exit category and output-path absence/presence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

A bounded argument-length diagnostic reproduced the omission through both
native Node and the local TypeScript wrapper. A fixed `cmd.exe` command line
preserved the empty scalar and generated the foundation candidate with exit
zero. Internal assertions confirmed the exact selector, absent AI attestation,
three schedules, and successful removal of the ephemeral artifact.
