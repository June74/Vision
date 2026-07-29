# SB-20260729-201617-powershell-pipeline-variable-typo

- **Status:** closed
- **Last observed:** 2026-07-29T20:16:17Z
- **Phase/task:** Phase B consolidated final-fix production workflow
- **Title:** PowerShell test search contained a pipeline-variable typo
- **Impact:** A read-only search printed repeated local command errors and returned no useful test context. No file or external state changed.
- **Cause:** A space split the PowerShell pipeline variable token in the formatting expression.
- **Resolution:** Stopped the failed search and used the previously captured exact test contract.
- **Recurrence:** First observation in this task.
