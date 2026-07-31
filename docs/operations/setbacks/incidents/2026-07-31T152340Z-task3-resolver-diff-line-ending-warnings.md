# SB-20260731-152340-task3-resolver-diff-line-ending-warnings: Resolver diff suppression left normalization advisories

- **Status:** closed
- **First observed:** 2026-07-31T15:23:40.5189569Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 final resolver review repair
- **Environment:** Windows Git owned-diff verification
- **Version/commit:** 73191b7 plus unstaged GREEN repairs and setback records

## Symptom

The resolver owned diff check exited zero but still emitted four line-ending
conversion advisories despite the first configuration override.

## Impact

The resolver runtime, TypeScript, and documentation gates are green, but the
requested warning-suppressed evidence form has not yet been produced.

## Reproduction conditions

Run the resolver owned diff under the first Git override while the broader
Windows auto-conversion setting remains active.

## Safe evidence

Only the aggregate warning count and normalization category were reported. No
file content, URI, credential, protected identifier, provider value, runtime
stream, argument, or environment value was emitted.

## Attempts and outcomes

- Resolver tests pass 71/71.
- Canonical TypeScript and docs coverage pass.
- Diff validation exits zero.

## Cause classification

- **Confirmed cause:** Windows Git normalization advisory not fully suppressed
  by the first override.
- **Hypotheses:** Disabling both auto-CRLF conversion and safe-CRLF warnings for
  the read-only command should produce the requested evidence form.
- **Rejected hypotheses:** No whitespace defect is reported.
- **Known exclusions:** No content, Git index, provider, network, or external
  mutation occurred.

## Correction and prevention

- **Correction:** Retry the read-only check with both conversion overrides;
  never rewrite content to silence the advisory.
- **Prevention:** Use the validated two-setting form for Windows warning-free
  diff evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** One configuration-only owned diff retry.

## Verification and related work

The resolver retry produced zero-exit, zero-warning owned diff evidence. The
root ordinary output-suppressed integration diff check also exited zero.

## Recurrence history

- 2026-07-31T15:23:40.5189569Z: First observed and contained after zero-exit
  diff validation.
- 2026-07-31T15:30:50.5669463Z: Closed after warning-free resolver evidence
  and successful root integration diff verification.
