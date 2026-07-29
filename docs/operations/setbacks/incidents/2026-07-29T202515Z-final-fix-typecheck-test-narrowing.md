# SB-20260729-202515-final-fix-typecheck-test-narrowing

- **Status:** closed
- **Last observed:** 2026-07-29T20:27:22Z
- **Phase/task:** Phase B consolidated final-fix typecheck
- **Title:** New contract tests inferred types narrower than their test operations
- **Impact:** Typecheck reported two test-only errors after the focused runtime suite passed. No runtime or external state changed.
- **Cause:** One negative membership check used a tuple whose literal union intentionally excluded the queried names, one fixture replacement targeted a property inferred from a narrower initial object, and the replacement attempted a mutable reverse directly on a readonly tuple clone.
- **Resolution:** Widened only the test-side membership view and fixture replacement boundary, copied the readonly tuple before reversing it, and passed the full typecheck.
- **Recurrence:** The second typecheck confirmed the first fix and exposed the remaining readonly-array operation.
