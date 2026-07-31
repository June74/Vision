# SB-20260731-050919-task3-review-package-encoding-enum: Review generator used an unsupported PowerShell encoding label

- **Status:** closed
- **First observed:** 2026-07-31T05:09:19.1673426Z
- **Last observed:** 2026-07-31T05:10:29.0479307Z
- **Phase/task:** Phase B Task 3 final review package
- **Environment:** Main Phase B worktree; Windows PowerShell
- **Version/commit:** 280c7ab

## Symptom

The mechanical review-package generator requested the `utf8NoBOM` encoding
label, which this Windows PowerShell version does not support. Subsequent
validation steps then received a missing package and emitted cascading null
errors.

## Impact

The sanitized review package was not created. No repository source, Git state,
or external state changed.

## Reproduction conditions

Use a PowerShell 7 encoding label with the older Windows PowerShell
`Set-Content` encoding enumeration, without fail-fast handling after the write.

## Safe evidence

The target package is absent. The error output contained only tool categories
and parameter names; no diff content, URI, credential, provider value,
protected identifier, or external state was emitted.

## Attempts and outcomes

- Package text was assembled and sanitized in memory.
- The unsupported encoding parameter prevented the write.
- Validation cascaded against the absent file.

## Cause classification

- **Confirmed cause:** `utf8NoBOM` is not a valid encoding enumerator in this
  Windows PowerShell runtime.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No file was partially created.
- **Known exclusions:** No sensitive content or external mutation occurred.

## Correction and prevention

- **Correction:** Use the supported `UTF8` encoding and stop immediately if the
  write fails before any validation.
- **Prevention:** Check runtime-supported encoding labels or use a compatible
  encoding when generating ignored review artifacts.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Regeneration with supported UTF-8 and fail-fast handling produced a package
covering 10 commits, 75 changed paths, and 75 diff markers. Validation found
nine redaction markers and zero remaining scheme URI, email, or unsafe
credential-assignment tokens.

## Recurrence history

- 2026-07-31T05:09:19.1673426Z: First observed and contained; package absence
  confirmed.
- 2026-07-31T05:10:29.0479307Z: Closed after compatible generation and all
  bounded package-validation checks passed.
