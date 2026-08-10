# SB-20260802-025120-task8-overbroad-hex-redaction: Hash redactor mangled ordinary words

- **Status:** closed
- **First observed:** 2026-08-02T02:51:20.4597400Z
- **Last observed:** 2026-08-02T02:52:24.1499463Z
- **Phase/task:** Phase B Task 8 legacy-evidence readiness audit
- **Environment:** Local privacy-safe documentation search
- **Version/commit:** Published Task 7 candidate on `codex/phase-b-foundation`

## Symptom

A sanitizer replaced long runs of hexadecimal characters even when those runs
appeared inside ordinary status words, making the safe search output harder to
read.

## Impact

Several local status words were partially redacted. No protected value was
exposed, and no repository, provider, database, calendar, credential, or key
state changed.

## Reproduction conditions

Apply an unbounded hexadecimal-run expression to complete prose lines without
requiring token boundaries.

## Safe evidence

The output contained redaction placeholders inside ordinary evidence words.
No raw identifier or protected value was retained.

## Attempts and outcomes

- The first sanitizer used a bare hexadecimal-run pattern.
- The retry will require non-alphanumeric token boundaries on both sides.
- The first verification predicate expected the wrong grammatical form of the
  status word and therefore could not prove preservation; the source line was
  not displayed or changed.

## Cause classification

- **Confirmed cause:** The expression did not require token boundaries.
- **Hypotheses:** None.
- **Rejected hypotheses:** No source file corruption occurred; only the
  displayed diagnostic text was transformed.
- **Known exclusions:** No external state or protected content was involved.

## Correction and prevention

- **Correction:** Use a boundary-aware hash expression and output only the
  bounded readiness status lines.
- **Prevention:** Never apply a bare hexadecimal-run expression to prose.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun the same bounded search with token boundaries
  and confirm ordinary status words remain intact.

## Verification and related work

The boundary-aware expression preserved both the actual success-status word and
the pending-status word while retaining hash-token redaction behavior. Only
Boolean verification results were displayed.
