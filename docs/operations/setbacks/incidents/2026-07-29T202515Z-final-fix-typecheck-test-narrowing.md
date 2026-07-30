# SB-20260729-202515-final-fix-typecheck-test-narrowing

- **Status:** closed
- **Last observed:** 2026-07-30T01:24:19.8895830Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 4
- **Title:** New contract tests inferred types narrower than their test operations
- **Impact:** Typecheck reported two test-only errors after the focused runtime suite passed. No runtime or external state changed.
- **Cause:** One negative membership check used a tuple whose literal union intentionally excluded the queried names, one fixture replacement targeted a property inferred from a narrower initial object, and the replacement attempted a mutable reverse directly on a readonly tuple clone.
- **Resolution:** Widened only the test-side membership view and fixture replacement boundary, copied the readonly tuple before reversing it, and passed the full typecheck.
- **Recurrence:** The second typecheck confirmed the first fix and exposed the remaining readonly-array operation.
- **Recurrence:** The wave-2 typecheck found that the new immutable restore-proof
  interface was narrower than the generic canonical-record digest input. Tests
  had passed because the mismatch is static only; no runtime or external state
  changed. The digest boundary is narrowed to the exact proof interface.
- **Recurrence:** The wave-4 cleanup regression passed at runtime but typecheck
  rejected its readonly required-path tuple at Vitest's mutable
  `arrayContaining` boundary. The failure occurred before the aggregate test
  gates and changed no runtime or external state.
- **Resolution:** Copied the four-element readonly tuple only at the matcher
  boundary. The direct full typecheck then passed.
