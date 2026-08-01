# SB-20260727-202807-powershell-node-e-quote-loss: PowerShell Node eval lost import quotes

- **Status:** closed
- **First observed:** 2026-07-27T20:28:07Z
- **Last observed:** 2026-07-30T20:04:58.3251770Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Approved local shell network path
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The first shell diagnostic passed a JavaScript module through `node -e`, and
Windows argument processing removed the quotes around the package name. Node
failed at parse time.

## Impact

No database connection or SQL query occurred. The private URL was not printed,
and the `finally` block deleted the short-lived bridge file.

## Cause classification

- **Confirmed cause:** Multi-layer PowerShell/Windows quoting changed the
  JavaScript source passed as an argument.
- **Known exclusions:** Closed verification confirmed the temp bridge is absent.

## Correction and prevention

- **Correction:** Pipe the in-memory JavaScript source to Node standard input
  with module mode instead of passing it as a command-line argument.
- **Prevention:** Avoid `node -e` for quoted ESM source in this Windows shell.

## Verification and related work

The failed bridge file is absent. A fresh bridge and standard-input retry are
required.

## Recurrence history

- 2026-07-30T20:04:58.3251770Z: A Task 1 reviewer passed a synthetic branch
  check through `tsx -e`; Windows PowerShell stripped inner quoting and
  esbuild rejected the malformed evaluation before project import or
  execution. No source, environment, provider data, or file changed. The
  reviewer will decide from existing tests/package evidence instead of
  retrying an eval command.
- 2026-08-01T00:59:00.0000000Z: Recurred when a Gate 0 read-only R2 count
  probe passed an in-memory TypeScript module through `tsx.cmd -e`.
  PowerShell stripped import quotes and esbuild rejected the probe before the
  project scanner executed. No file or external state changed. Gate 0 uses
  the already-green focused structural test, which asserts one adapter and
  exactly two approved permanent callers.
