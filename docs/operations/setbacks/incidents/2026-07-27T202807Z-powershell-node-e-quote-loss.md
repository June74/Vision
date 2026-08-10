# SB-20260727-202807-powershell-node-e-quote-loss: PowerShell Node eval lost import quotes

- **Status:** closed
- **First observed:** 2026-07-27T20:28:07Z
- **Last observed:** 2026-08-02T18:18:11.4063877Z
- **Phase/task:** Phase B Task 8 through OAuth reconnect Task 2 diagnostics
- **Environment:** Local shell diagnostic path
- **Version/commit:** `a4376ab` plus the uncommitted Task 2 PostgreSQL proof

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
- 2026-08-01T03:40:32.1352196Z: Recurred while proving the local ignored Task 8
  provider driver. A PowerShell probe passed a serialized JSON driver argument
  directly to `node`; Windows argument processing stripped the inner double
  quotes, the driver rejected the malformed input, and the approval-seam probe
  reported a false negative. No provider call, dispatch, deployment, approval,
  or tracked file was affected. Correction: exercise the driver only through an
  `execFile` argument array, exactly as the acceptance controller invokes it.
  The rewritten self-test passes 5/5, and a mutation of the canonical-instant
  guard was confirmed to turn precisely one assertion red before restore.
- 2026-08-02T05:13:53.8273916Z: Recurred when an import-only check passed an
  inline expression through `tsx.cmd -e`; Windows command parsing rejected the
  expression before importing the ignored OAuth-tail runner. The filter's
  separate file-based self-test had already passed 8/8. No network, provider,
  browser, deployment, credential, key, or application action occurred. The
  runner will be checked through a file-based TypeScript command instead.
- 2026-08-02T05:41:08.8049896Z: A later worktree inventory found that the same
  failed inline-expression attempt had created one 474-byte script-fragment
  file at the repository root. The fragment was positively attributed by its
  name and timestamp to that attempt and removed with the patch tool. No user
  file, source file, provider state, credential, or key was removed or changed.
- 2026-08-02T18:18:11.4063877Z: Recurred when the reconnect diagnostic tried
  to reproduce Windows native-stderr promotion through a nested `node -e`
  expression. Quoting broke before Node executed the intended code. No
  database, network, provider, credential, or repository state changed. The
  correction uses ignored file-based scripts with no nested evaluation.
