# SB-20260803-190954-readonly-probe-progress-clixml: Read-only probe emitted PowerShell progress CLIXML

- **Status:** contained
- **First observed:** 2026-08-03T19:09:54.890550Z
- **Last observed:** 2026-08-03T19:10:01.5360007Z
- **Phase/task:** Phase B Wrangler JSON-query diagnosis
- **Environment:** Approved Windows PowerShell 5.1 encoded read-only probe
- **Version/commit:** diagnostic only; no product or provider change

## Symptom

The approved three-boolean deployment-list probe also emitted generic PowerShell module-progress CLIXML after the sanitized JSON booleans.

## Impact

No private data was exposed, but the probe exceeded its approved output shape and future probes must suppress progress explicitly.

## Reproduction conditions

Launch an encoded Windows PowerShell probe without setting its progress
preference before module initialization.

## Safe evidence

The extra stream contained only PowerShell progress serialization for module
preparation. It contained no provider response, account value, deployment
identifier, credential, secret, URL, or command payload.

## Attempts and outcomes

The three approved booleans were emitted correctly, followed by the unrelated
progress stream. No retry was made.

## Cause classification

- **Confirmed cause:** The encoded probe omitted an explicit
  `ProgressPreference = SilentlyContinue` before PowerShell initialized the
  required modules.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The extra content came from the provider response.
- **Known exclusions:** No private or mutable external state appeared in the
  extra stream.

## Correction and prevention

- **Correction:** Set the progress preference before any future probe setup.
- **Prevention:** Sanitized probe contracts must cover every PowerShell stream,
  not only stdout returned by the target command.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** If another probe is approved, verify that only its
  fixed sanitized category is emitted.

## Verification and related work

Contained by explicit progress suppression in the next probe design; runtime
verification is pending because no additional live read is authorized.

## Recurrence history

- 2026-08-03T19:09:54.890550Z: First observed.
- 2026-08-03T19:10:01.5360007Z: Cause confirmed and next-probe suppression
  requirement recorded.
