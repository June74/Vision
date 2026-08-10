# SB-20260803-044013-sdd-directory-enumeration-timeout: Broad SDD artifact enumeration timed out

- **Status:** closed
- **First observed:** 2026-08-03T04:40:13.7189769Z
- **Last observed:** 2026-08-03T04:40:13.7189769Z
- **Phase/task:** Phase B corrected-controller resume
- **Environment:** Local ignored SDD artifact directory
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

A recursive filename listing over the large ignored SDD artifact directory
produced excessive output and reached the command timeout while locating the
controller's schedule-evidence helper.

## Impact

The lookup was delayed and its output was truncated. No file, deployment,
provider resource, credential, calendar, database, or key changed.

## Safe evidence

The command returned a timeout category after listing local artifact filenames.
It did not read file contents or output secret values.

## Cause classification

- **Confirmed cause:** The lookup enumerated every file in a directory that is
  known to contain hundreds of large review artifacts instead of targeting the
  controller and its three fixed evidence filenames.
- **Known exclusions:** No network request or external mutation occurred.

## Correction and prevention

- **Correction:** Use exact controller/evidence paths and bounded line reads.
- **Prevention:** Never recursively enumerate `.superpowers/sdd` to locate a
  known artifact; use the fixed path or an exact filename filter.
- **Owner:** Codex.

## Verification and related work

The exact controller path was already known and a bounded read succeeded. The
failed enumeration is not being retried.

## Recurrence history

- 2026-08-03T04:40:13.7189769Z: First occurrence, immediately contained.
