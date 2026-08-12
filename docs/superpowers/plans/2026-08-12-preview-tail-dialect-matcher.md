# Preview Tail Bounded Dialect Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated tail-observer failure parsing with one exact, bounded, shared dialect protocol that recognizes all fourteen currently emitted safe categories and rejects unknown or malformed stderr.

**Architecture:** Add a small `scripts/preview-tail-observer-dialect.ts` protocol module containing the immutable category tuple, raw category type, byte bound, and complete-line parser. `print-safe-tail.ts` imports the shared category type/tuple; `run-preview-tail-supervisor.ts` imports the parser and uses a typed exact mapping to its existing prefixed failure categories. The supervisor keeps its bounded rolling suffix and existing lifecycle facts unchanged.

**Tech Stack:** TypeScript, Node.js streams/`Buffer`, Vitest unit tests, Markdown reference coverage, pnpm scripts, GitHub Actions preview workflow.

---

## Files and responsibilities

- Create `scripts/preview-tail-observer-dialect.ts`: immutable fourteen-token
  vocabulary, maximum parser input size of 128 UTF-8 bytes, and one complete
  marker-line parser returning only a shared raw category or `null`.
- Create `tests/unit/scripts/preview-tail-observer-dialect.test.ts`: protocol
  acceptance/rejection, bounds, line-boundary, CRLF/LF, injection, and unknown
  category tests.
- Modify `scripts/print-safe-tail.ts`: remove its duplicated failure-category
  union and import the shared tuple/type; retain the existing fixed marker text.
- Modify `scripts/run-preview-tail-supervisor.ts`: import the shared parser/type,
  retain only a 128-character diagnostic suffix, add the six missing prefixed
  supervisor categories, and replace the local regex/switch with a typed exact
  record mapping.
- Modify `tests/unit/scripts/preview-tail-supervisor.test.ts`: prove every
  maintenance marker maps to its prefixed supervisor category and prove a
  marker split across stderr chunks is recognized without exposing raw text.
- Create `docs/reference/simple/scripts/preview-tail-observer-dialect.md` and
  `docs/reference/technical/scripts/preview-tail-observer-dialect.md`: document
  the shared vocabulary, grammar, byte bound, and privacy behavior.
- Modify the simple and technical supervisor references to describe shared
  parsing and maintenance-category mapping.

## Task 1: Write the protocol RED tests

**Files:**

- Create: `tests/unit/scripts/preview-tail-observer-dialect.test.ts`

- [ ] **Step 1: Add the wished-for parser contract.**

Use this test shape before creating the production module:

```ts
import { describe, expect, it } from "vitest";
import {
  PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES,
  parsePreviewTailObserverFailureMarker,
} from "../../../scripts/preview-tail-observer-dialect";

const marker = (category: string) =>
  `Preview tail observer failed closed: ${category}.`;

describe("preview tail observer dialect", () => {
  it("admits every current fixed category", () => {
    for (const category of PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES) {
      expect(parsePreviewTailObserverFailureMarker(`${marker(category)}\n`))
        .toBe(category);
    }
  });

  it.each([
    "maintenance_unknown",
    "observer_runtime_error extra",
    "observer_runtime_error;secret",
    "Preview tail observer failed closed: observer_runtime_error",
    "xPreview tail observer failed closed: observer_runtime_error.",
    "Preview tail observer failed closed: observer_runtime_error.\nextra",
  ])("rejects malformed or unknown marker %j", (input) => {
    expect(parsePreviewTailObserverFailureMarker(input)).toBeNull();
  });

  it("accepts LF and CRLF complete lines", () => {
    expect(parsePreviewTailObserverFailureMarker(
      "prefix\nPreview tail observer failed closed: maintenance_outcome_mismatch.\n",
    )).toBe("maintenance_outcome_mismatch");
    expect(parsePreviewTailObserverFailureMarker(
      "Preview tail observer failed closed: maintenance_outcome_mismatch.\r\n",
    )).toBe("maintenance_outcome_mismatch");
  });

  it("rejects input over the 128-byte protocol bound", () => {
    const oversized = `${"x".repeat(90)}\n${marker("observer_runtime_error")}\n`;
    expect(parsePreviewTailObserverFailureMarker(oversized)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new test and verify the expected RED.**

Run:

```powershell
pnpm.cmd test:unit -- tests/unit/scripts/preview-tail-observer-dialect.test.ts
```

Expected result before implementation: test collection fails because
`scripts/preview-tail-observer-dialect.ts` does not exist. Do not add
production code until this failure is observed.

- [ ] **Step 3: Commit the RED test only.**

```powershell
git add tests/unit/scripts/preview-tail-observer-dialect.test.ts
git commit -m "test: define bounded tail observer dialect"
```

## Task 2: Add supervisor RED coverage for the missing categories

**Files:**

- Modify: `tests/unit/scripts/preview-tail-supervisor.test.ts`

- [ ] **Step 1: Add one parameterized mapping test.**

Add a child fixture that writes one fixed marker and exits with code `1`, then
parameterize the six currently missing raw categories and expected prefixed
categories:

```ts
it.each([
  ["maintenance_schedule_mismatch", "consumer_maintenance_schedule_mismatch"],
  ["maintenance_outcome_mismatch", "consumer_maintenance_outcome_mismatch"],
  ["maintenance_category_mismatch", "consumer_maintenance_category_mismatch"],
  ["maintenance_repair_failure", "consumer_maintenance_repair_failure"],
  ["maintenance_renewal_failure", "consumer_maintenance_renewal_failure"],
  ["maintenance_repair_not_reserved", "consumer_maintenance_repair_not_reserved"],
] as const)("maps %s to %s", async (raw, expected) => {
  await expect(supervisePreviewTail({
    producer: node("setInterval(()=>{},1000)"),
    consumer: node(
      `process.stderr.write("Preview tail observer failed closed: ${raw}.\\n");process.exit(1);`,
    ),
  })).rejects.toMatchObject({ category: expected, consumerExitCode: 1 });
});
```

- [ ] **Step 2: Add the split-chunk regression.**

The child must write the fixed line in two event-loop turns so the supervisor
sees a fragmented stderr marker:

```ts
it("recognizes a maintenance marker split across stderr chunks", async () => {
  await expect(supervisePreviewTail({
    producer: node("setInterval(()=>{},1000)"),
    consumer: node(
      'process.stderr.write("Preview tail observer failed closed: maintenance_");' +
      'setImmediate(()=>{process.stderr.write("outcome_mismatch.\\n");process.exit(1);});',
    ),
  })).rejects.toMatchObject({
    category: "consumer_maintenance_outcome_mismatch",
    consumerExitCode: 1,
    producerClosedFirst: false,
  });
});
```

- [ ] **Step 3: Run the focused supervisor test and verify RED.**

Run:

```powershell
pnpm.cmd test:unit -- tests/unit/scripts/preview-tail-supervisor.test.ts
```

Expected result before integration: the new cases fail because the existing
supervisor union and local switch do not admit the maintenance categories.

- [ ] **Step 4: Commit the additional RED coverage.**

```powershell
git add tests/unit/scripts/preview-tail-supervisor.test.ts
git commit -m "test: cover maintenance tail dialect mappings"
```

## Task 3: Implement the shared protocol and integrations

**Files:**

- Create: `scripts/preview-tail-observer-dialect.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `scripts/run-preview-tail-supervisor.ts`

- [ ] **Step 1: Add the shared immutable vocabulary and parser.**

The module must export only the category tuple, its type, the 128-byte bound,
and the parser. The parser uses this exact grammar and never returns input
text:

```ts
const MARKER = /(?:^|\r?\n)Preview tail observer failed closed: ([a-z][a-z0-9_]{0,63})\.(?:\r?\n|$)/u;

export function parsePreviewTailObserverFailureMarker(
  input: string,
): PreviewTailObserverFailureCategory | null {
  if (
    typeof input !== "string" ||
    Buffer.byteLength(input, "utf8") > PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES
  ) return null;
  const category = MARKER.exec(input)?.[1];
  if (!category) return null;
  return PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES.includes(
    category as PreviewTailObserverFailureCategory,
  ) ? category as PreviewTailObserverFailureCategory : null;
}
```

The tuple must contain exactly the fourteen categories in the approved design,
and the module must give the tuple, bound, and parser complete JSDoc because
the repository's documentation validator scans production script APIs.

- [ ] **Step 2: Make `print-safe-tail.ts` use the shared type and tuple.**

Remove its local `PreviewTailObserverFailureCategory` union. Import the shared
type and tuple. Keep the marker text exactly unchanged. Before writing, use the
tuple as a runtime membership guard so an invalid JavaScript caller fails
closed without printing arbitrary input.

- [ ] **Step 3: Replace the supervisor regex/switch with a typed exact record.**

Import `parsePreviewTailObserverFailureMarker` and the shared raw type. Add the
six missing members to `PreviewTailFailureCategory`. Define a complete typed
record mapping every raw category to `consumer_<raw-category>`, then implement:

```ts
function classifyConsumerFailureCategory(
  chunk: string,
): PreviewTailFailureCategory | null {
  const raw = parsePreviewTailObserverFailureMarker(chunk);
  return raw === null
    ? null
    : CONSUMER_FAILURE_CATEGORY_BY_OBSERVER_CATEGORY[raw];
}
```

Change the retained diagnostic suffix from 96 to 128 characters. Leave child
shutdown, exit-code capture, producer ordering, and `consumer_silent`/
`consumer_unrecognised` fallback behavior unchanged.

- [ ] **Step 4: Run focused GREEN verification.**

Run:

```powershell
pnpm.cmd test:unit -- tests/unit/scripts/preview-tail-observer-dialect.test.ts
pnpm.cmd test:unit -- tests/unit/scripts/preview-tail-supervisor.test.ts
```

Expected result: all new protocol and mapping tests pass, with no raw sentinel
text in captured output.

- [ ] **Step 5: Commit the implementation.**

```powershell
git add scripts/preview-tail-observer-dialect.ts scripts/print-safe-tail.ts scripts/run-preview-tail-supervisor.ts tests/unit/scripts/preview-tail-observer-dialect.test.ts tests/unit/scripts/preview-tail-supervisor.test.ts
git commit -m "fix: share bounded tail observer dialect"
```

## Task 4: Add documentation and run repository verification

**Files:**

- Create: `docs/reference/simple/scripts/preview-tail-observer-dialect.md`
- Create: `docs/reference/technical/scripts/preview-tail-observer-dialect.md`
- Modify: `docs/reference/simple/scripts/run-preview-tail-supervisor.md`
- Modify: `docs/reference/technical/scripts/run-preview-tail-supervisor.md`

- [ ] **Step 1: Document the shared module.**

Both reference files must include headings for
`PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES`,
`PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES`, and
`parsePreviewTailObserverFailureMarker`. Explain the exact marker, fourteen
tokens, 128-byte cap, chunk suffix, CRLF/LF handling, and rejection of unknown
or value-bearing text without quoting provider output.

- [ ] **Step 2: Update supervisor references.**

Describe that `classifyConsumerFailureCategory` delegates to the shared parser
and maps every admitted raw token to a prefixed safe category. Document that
unknown and malformed input remains `consumer_unrecognised`.

- [ ] **Step 3: Run documentation and source checks.**

```powershell
git diff --check
pnpm.cmd docs:check
pnpm.cmd typecheck
```

Expected result: no whitespace violations, no documentation-coverage
violations, and clean TypeScript checks.

- [ ] **Step 4: Commit documentation.**

```powershell
git add docs/reference/simple/scripts/preview-tail-observer-dialect.md docs/reference/technical/scripts/preview-tail-observer-dialect.md docs/reference/simple/scripts/run-preview-tail-supervisor.md docs/reference/technical/scripts/run-preview-tail-supervisor.md
git commit -m "docs: document bounded tail dialect"
```

## Task 5: Full verification and handoff

- [ ] **Step 1: Run the complete local verification suite.**

```powershell
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd build
git diff --check
git status --short --branch
```

Expected result: all tests pass, production build succeeds, diff check is
clean, and the worktree contains only intentional committed changes.

- [ ] **Step 2: Review the final diff against the approved spec.**

Confirm that only the shared dialect module, its tests, the two callers,
reference documentation, and required setback records changed. Confirm there
are no secret values, provider payloads, identifiers, database URLs, or raw
runner stderr in tracked files.

- [ ] **Step 3: Push the verified commits.**

```powershell
git push origin codex/phase-b-foundation
```

- [ ] **Step 4: Perform live validation only after local verification.**

Capture the reviewed branch tip at dispatch time and run one fresh maintenance
observer. Report only `category`, `consumer_exit`, and
`producer_closed_first`. Do not deploy, rotate credentials, or open a support
case from the old generic classification.
