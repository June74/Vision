# SB-20260806-215724-gate-runner-marker-assumption: Combined gate runner assumed the wrong success marker

- **Status:** closed
- **First observed:** 2026-08-06T21:57:24Z
- **Last observed:** 2026-08-06T21:58:34.0614582Z
- **Area:** Phase B local launcher and deployment-classifier verification
- **Impact:** The local gate wrapper stopped after a successful classifier-unverified contract because it expected a marker that this test does not emit. No provider command was launched and no deployment state changed.

## Evidence

The direct launcher contract had already passed. The classifier-unverified test exited zero but emits the allowlisted marker `behavioral_contracts_currently_pass`, not the wrapper's guessed marker. The wrapper therefore reported only a local marker-missing condition and did not continue to later gates.

## Cause classification

- **Confirmed cause:** The wrapper encoded a guessed per-test success-marker name instead of using the test's actual contract marker.
- **Hypotheses:** None.
- **Rejected hypotheses:** The classifier test itself was not failing; this was a verification-wrapper assumption.

## Correction and prevention

- Rerun each test with its source-defined allowlisted marker.
- Keep gate invocation and marker assertions separate from provider-facing execution.
- Do not print captured test stderr/stdout when a gate fails; report only the gate name, exit status, and a safe category.

## Owner and next step

- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the actual source-defined markers were used
  and all five local gates passed.

## Verification

The direct launcher, classifier-unverified behavior, Wrangler failure
classifier, cleanup-deadline, and native-suite contracts all exited zero with
their source-defined allowlisted markers. No provider-facing process was
started.
