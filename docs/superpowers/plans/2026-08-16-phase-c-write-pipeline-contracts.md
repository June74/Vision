# Phase C Write-Pipeline Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Phase C provider-neutral calendar-write contract and deterministic approval state machine without enabling a Google event mutation.

**Architecture:** Keep the new behavior as a pure domain module. It validates a strict one-off create proposal, materializes an exact before/after preview, and returns frozen immutable operation values through explicit state transitions. The existing Worker, browser, Google synchronization adapter, PostgreSQL schema, and Phase B read path remain unchanged until the next Phase C increment.

**Tech Stack:** TypeScript, Zod, Vitest, existing Vision domain schemas, existing simple/technical documentation coverage.

**Concurrency limit:** No more than 20 agents may be active at once. This plan uses inline execution and at most one serial reviewer; the intended active-agent count is 0 during implementation and 1 only during review.

---

## File map

- Create: `src/domain/calendar-write/approval.ts` — strict proposal contract, preview shape, reason codes, and pure state transitions.
- Create: `tests/unit/domain/calendar-write-approval.test.ts` — red/green unit coverage for validation, preview, stale approval, lifecycle transitions, immutability, and hostile input.
- Create: `docs/reference/simple/src/domain/calendar-write/approval.md` — plain-language production-file reference.
- Create: `docs/reference/technical/src/domain/calendar-write/approval.md` — signatures, invariants, and provider boundary reference.
- Modify: `docs/operations/phase-c-handoff.md` — record that the first no-provider-mutation contract increment is implemented and identify the next one-off-create boundary.
- Modify: `PROJECT_PLAN.md` — mark Phase C implementation as started at the contract increment only.
- Create: `docs/operations/setbacks/incidents/2026-08-16T145455Z-phase-b-progress-anchor-regression.md` — already created during baseline diagnosis; retain its index row and closure evidence.
- Modify: `docs/operations/setbacks/INDEX.md` — already updated during baseline diagnosis; preserve the valid table layout.

### Task 1: Write the failing contract tests

**Files:**
- Create: `tests/unit/domain/calendar-write-approval.test.ts`
- Test target to be created next: `src/domain/calendar-write/approval.ts`

- [ ] **Step 1: Add the smallest valid proposal fixture and valid-preview test.**

```typescript
import { describe, expect, it } from "vitest";
import {
  CalendarWriteContractError,
  createCalendarWriteProposal,
  transitionCalendarWrite,
  type CalendarWriteProposalInput,
} from "../../../src/domain/calendar-write/approval";

const validInput = (): CalendarWriteProposalInput => ({
  operationId: "op-phase-c-001",
  ownerId: "owner-phase-c",
  target: { calendarId: "calendar-vision", version: "etag-001" },
  requestedAt: "2026-08-16T14:00:00.000Z",
  event: {
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-17T15:00:00.000Z",
    endsAt: "2026-08-17T16:00:00.000Z",
    timeZone: "America/Chicago",
    domain: "work",
    privacy: "private",
    attendees: [],
    recurrence: null,
    notifications: "none",
  },
});

describe("calendar write approval contract", () => {
  it("creates an exact immutable one-off before/after preview", () => {
    const proposal = createCalendarWriteProposal(validInput());

    expect(proposal).toMatchObject({
      operationId: "op-phase-c-001",
      action: "create",
      status: "proposed",
      target: { calendarId: "calendar-vision", version: "etag-001" },
      preview: {
        before: null,
        after: {
          title: "Focus block",
          description: "Protected planning note",
          startsAt: "2026-08-17T15:00:00.000Z",
          endsAt: "2026-08-17T16:00:00.000Z",
          timeZone: "America/Chicago",
          domain: "work",
          privacy: "private",
          attendees: { mode: "none", count: 0, addresses: [] },
          recurrence: { scope: "one-off", rules: [] },
          notifications: { policy: "none", willNotify: false },
        },
      },
    });
    expect(Object.isFrozen(proposal)).toBe(true);
    expect(Object.isFrozen(proposal.preview)).toBe(true);
    expect(Object.isFrozen(proposal.preview.after)).toBe(true);
  });

  it("rejects non-empty attendees with a stable reason code", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, attendees: ["person@example.test"] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_ATTENDEES" }),
    );
  });

  it("rejects recurrence input instead of silently dropping it", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, recurrence: ["RRULE:FREQ=DAILY"] },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_RECURRENCE" }),
    );
  });

  it("rejects a non-none notification policy instead of hiding provider effects", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, notifications: "all" },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_NOTIFICATIONS" }),
    );
  });

  it("rejects an interval whose end is not after its start", () => {
    expect(() =>
      createCalendarWriteProposal({
        ...validInput(),
        event: {
          ...validInput().event,
          endsAt: validInput().event.startsAt,
        },
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_PROPOSAL_INPUT" }),
    );
  });

  it("invalidates approval when the target calendar version is stale", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const invalidated = transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-002" },
    });

    expect(invalidated.status).toBe("invalidated");
    expect(invalidated.invalidatedReason).toBe("STALE_TARGET_VERSION");
  });

  it("allows only confirmed operations to enter writing and then a terminal result", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const confirmed = transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-001" },
    });
    const writing = transitionCalendarWrite(confirmed, { kind: "begin_write" });
    const verified = transitionCalendarWrite(writing, { kind: "verified" });

    expect(confirmed.status).toBe("confirmed");
    expect(writing.status).toBe("writing");
    expect(verified.status).toBe("verified");
  });

  it("rejects a write transition before confirmation", () => {
    expect(() =>
      transitionCalendarWrite(createCalendarWriteProposal(validInput()), {
        kind: "begin_write",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_STATE_TRANSITION" }),
    );
  });

  it("does not mutate the proposal while transitioning it", () => {
    const proposal = createCalendarWriteProposal(validInput());
    const original = JSON.stringify(proposal);

    transitionCalendarWrite(proposal, {
      kind: "approve",
      target: { calendarId: "calendar-vision", version: "etag-001" },
    });

    expect(JSON.stringify(proposal)).toBe(original);
    expect(proposal.status).toBe("proposed");
  });

  it("rejects unsupported object shapes without invoking getters", () => {
    let getterCalled = false;
    const input = validInput() as unknown as Record<string, unknown>;
    Object.defineProperty(input, "unexpected", {
      enumerable: true,
      get() {
        getterCalled = true;
        return "should not be read";
      },
    });

    expect(() => createCalendarWriteProposal(input)).toThrowError(
      expect.objectContaining({ code: "INVALID_PROPOSAL_INPUT" }),
    );
    expect(getterCalled).toBe(false);
  });

  it("exposes stable error codes without reflecting rejected values", () => {
    try {
      createCalendarWriteProposal({
        ...validInput(),
        event: { ...validInput().event, title: "" },
      });
      throw new Error("expected proposal creation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CalendarWriteContractError);
      expect(error).toMatchObject({ code: "INVALID_PROPOSAL_INPUT" });
      expect((error as Error).message).not.toContain("title");
    }
  });
});
```

- [ ] **Step 2: Run the focused test to verify the expected RED state.**

Run:

```powershell
node_modules\.bin\vitest.cmd run --project unit tests/unit/domain/calendar-write-approval.test.ts
```

Expected: FAIL because `src/domain/calendar-write/approval.ts` does not yet
exist. This is the intentional TDD RED check; do not record it as a setback.

- [ ] **Step 3: Commit the RED test only.**

```powershell
git add -- tests/unit/domain/calendar-write-approval.test.ts
git commit -m "test: define Phase C write approval contract"
```

### Task 2: Implement the pure approval contract

**Files:**
- Create: `src/domain/calendar-write/approval.ts`
- Test: `tests/unit/domain/calendar-write-approval.test.ts`

- [ ] **Step 1: Add the strict schemas, public types, error codes, and frozen-value helper.**

The module will use these exact public shapes and no provider import:

```typescript
import { z } from "zod";
import { DomainSchema, type Domain } from "../categorization/category";
import { PrivacyLevelSchema, type PrivacyLevel } from "../privacy/privacy";

const opaqueId = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const boundedTitle = z.string().min(1).max(1_024);
const nullableDescription = z.string().max(8_192).nullable();
const timestamp = z.string().datetime({ offset: true });
const boundedTimeZone = z.string().min(1).max(255);
const targetSchema = z.object({ calendarId: opaqueId, version: opaqueId }).strict();
const eventSchema = z.object({
  title: boundedTitle,
  description: nullableDescription,
  startsAt: timestamp,
  endsAt: timestamp,
  timeZone: boundedTimeZone,
  domain: DomainSchema.exclude(["unresolved"]),
  privacy: PrivacyLevelSchema,
  attendees: z.array(z.string().min(1).max(320)).max(50),
  recurrence: z.unknown(),
  notifications: z.string().min(1).max(32),
}).strict();

export const CALENDAR_WRITE_REASON_CODES = [
  "INVALID_PROPOSAL_INPUT",
  "UNSUPPORTED_ATTENDEES",
  "UNSUPPORTED_RECURRENCE",
  "UNSUPPORTED_NOTIFICATIONS",
  "STALE_TARGET_VERSION",
  "INVALID_STATE_TRANSITION",
] as const;
export type CalendarWriteReasonCode = (typeof CALENDAR_WRITE_REASON_CODES)[number];

export class CalendarWriteContractError extends Error {
  constructor(readonly code: CalendarWriteReasonCode) {
    super("Calendar write request is outside the approved contract.");
    this.name = "CalendarWriteContractError";
  }
}

export type CalendarWriteProposalInput = {
  readonly operationId: string;
  readonly ownerId: string;
  readonly target: { readonly calendarId: string; readonly version: string };
  readonly requestedAt: string;
  readonly event: {
    readonly title: string;
    readonly description: string | null;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly timeZone: string;
    readonly domain: Exclude<Domain, "unresolved">;
    readonly privacy: PrivacyLevel;
    readonly attendees: readonly string[];
    readonly recurrence: unknown;
    readonly notifications: string;
  };
};

export type CalendarWriteStatus =
  | "proposed"
  | "confirmed"
  | "invalidated"
  | "writing"
  | "verification_pending"
  | "verified"
  | "failed";

export interface CalendarEventPreview {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: Exclude<Domain, "unresolved">;
  readonly privacy: PrivacyLevel;
  readonly attendees: {
    readonly mode: "none";
    readonly count: 0;
    readonly addresses: readonly [];
  };
  readonly recurrence: { readonly scope: "one-off"; readonly rules: readonly [] };
  readonly notifications: { readonly policy: "none"; readonly willNotify: false };
}

export interface CalendarWriteProposal {
  readonly operationId: string;
  readonly ownerId: string;
  readonly action: "create";
  readonly requestedAt: string;
  readonly target: { readonly calendarId: string; readonly version: string };
  readonly preview: { readonly before: null; readonly after: CalendarEventPreview };
  readonly status: CalendarWriteStatus;
  readonly invalidatedReason?: "STALE_TARGET_VERSION";
}
```

- [ ] **Step 2: Add validation and proposal construction.**

The implementation must inspect property descriptors before reading values so
an enumerable getter or symbol cannot be invoked. It must classify non-empty
attendees, non-null recurrence, and non-`none` notifications before the final
schema parse so callers receive the closed reason codes above. It must parse
both timestamps and require `endsAt` to be later than `startsAt`, then return a
deep-frozen proposal with `before: null` and the exact empty attendee,
one-off-recurrence, and no-notification preview.

- [ ] **Step 3: Add pure state transitions.**

```typescript
export type CalendarWriteTransition =
  | { readonly kind: "approve"; readonly target: { readonly calendarId: string; readonly version: string } }
  | { readonly kind: "begin_write" }
  | { readonly kind: "verified" }
  | { readonly kind: "verification_pending" }
  | { readonly kind: "failed" };

export function transitionCalendarWrite(
  operation: CalendarWriteProposal,
  transition: CalendarWriteTransition,
): CalendarWriteProposal {
  // Validate the current status and exact target snapshot before returning a
  // newly frozen operation. No branch performs I/O or provider authorization.
}
```

`approve` is legal only from `proposed`; an exact calendar ID and version move
the operation to `confirmed`, while any target mismatch returns `invalidated`
with `STALE_TARGET_VERSION`. `begin_write` is legal only from `confirmed`.
The three result transitions are legal only from `writing`. Any other pair
throws `CalendarWriteContractError("INVALID_STATE_TRANSITION")`.

- [ ] **Step 4: Run the focused test to verify GREEN.**

Run:

```powershell
node_modules\.bin\vitest.cmd run --project unit tests/unit/domain/calendar-write-approval.test.ts
```

Expected: 11 tests pass with zero failures.

- [ ] **Step 5: Run type checks for source and tests.**

Run:

```powershell
node_modules\.bin\tsc.cmd --noEmit
node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
```

Expected: both commands exit 0 with no diagnostics.

- [ ] **Step 6: Commit the pure implementation.**

```powershell
git add -- src/domain/calendar-write/approval.ts tests/unit/domain/calendar-write-approval.test.ts
git commit -m "feat: add Phase C calendar write approval contract"
```

### Task 3: Add the required documentation references

**Files:**
- Create: `docs/reference/simple/src/domain/calendar-write/approval.md`
- Create: `docs/reference/technical/src/domain/calendar-write/approval.md`

- [ ] **Step 1: Add the plain-language reference.**

```markdown
# `src/domain/calendar-write/approval.ts`

This module describes a calendar change before Vision is allowed to send it to
Google. It makes the proposed change and its visible effects explicit, and it
does not call Google or write anything by itself.

## `createCalendarWriteProposal`

Checks a one-off event proposal, rejects unsupported attendees, recurrence, and
notifications, and returns a frozen before/after preview.

## `transitionCalendarWrite`

Moves a proposal through proposed, confirmed, writing, and verified or pending
outcomes. A changed calendar version invalidates approval.

## `CalendarWriteContractError`

Provides one safe reason code without reflecting rejected event content.
```

- [ ] **Step 2: Add the technical reference.**

```markdown
# `src/domain/calendar-write/approval.ts`

This provider-neutral module is the first Phase C write boundary. It has no
Google, Worker, database, crypto, or browser imports. Provider-facing code in a
later increment must consume the frozen proposal and state transitions rather
than recreate validation.

## `createCalendarWriteProposal`

**Signature:** `createCalendarWriteProposal(input: unknown): CalendarWriteProposal`

Validates strict owner, operation, target-calendar, timestamp, category,
privacy, and one-off event fields. It requires `endsAt > startsAt`, accepts an
empty attendee list, requires `recurrence: null`, and requires
`notifications: "none"`. It produces an immutable `before: null` and exact
after preview with no attendee notification effect.

## `transitionCalendarWrite`

**Signature:** `transitionCalendarWrite(operation, transition): CalendarWriteProposal`

The transition graph is `proposed -> confirmed -> writing -> verified | \
verification_pending | failed`; stale approval becomes `invalidated`. It
returns a new frozen value and throws only the constant
`INVALID_STATE_TRANSITION` or returns the constant stale reason.

## Security boundary

Descriptor inspection rejects symbols, accessors, inherited enumerable data,
unknown fields, and malformed values before provider or persistence code can
consume them. Error messages are constant and do not include title, attendee,
calendar, or operation values. Covered by
`tests/unit/domain/calendar-write-approval.test.ts`.
```

- [ ] **Step 3: Run documentation coverage and diff checks.**

Run:

```powershell
node_modules\.bin\tsx.cmd scripts\validate-doc-coverage.ts
git diff --check
```

Expected: documentation coverage exits 0 and `git diff --check` prints no
errors.

- [ ] **Step 4: Commit the references.**

```powershell
git add -- docs/reference/simple/src/domain/calendar-write/approval.md docs/reference/technical/src/domain/calendar-write/approval.md
git commit -m "docs: reference Phase C write approval contract"
```

### Task 4: Reconcile the project handoff and tracker

**Files:**
- Modify: `docs/operations/phase-c-handoff.md`
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Record the completed first increment without claiming provider writes.**

Add a short “Phase C increment 1” entry stating that the provider-neutral
proposal, exact preview, deterministic approval rules, stale-version
invalidation, immutable transition graph, tests, and documentation are
implemented. Keep the explicit statement that no HTTP route, Google event
mutation, database operation record, or live acceptance has been enabled.

- [ ] **Step 2: Update the tracker to show Phase C has started at increment 1.**

Change only the Phase C tracker wording needed to distinguish “implementation
started: contracts/state machine” from “one-off event create” and later
increments. Do not mark Phase C complete.

- [ ] **Step 3: Run documentation and whitespace checks.**

```powershell
node_modules\.bin\tsx.cmd scripts\validate-doc-coverage.ts
git diff --check
```

Expected: both checks exit 0.

- [ ] **Step 4: Commit the handoff update.**

```powershell
git add -- docs/operations/phase-c-handoff.md PROJECT_PLAN.md
git commit -m "docs: record Phase C contract increment"
```

### Task 5: Verify the clean Phase C increment

**Files:**
- Read-only verification of the files above and the existing Phase B suite.

- [ ] **Step 1: Run the focused domain test and both type checks.**

```powershell
node_modules\.bin\vitest.cmd run --project unit tests/unit/domain/calendar-write-approval.test.ts
node_modules\.bin\tsc.cmd --noEmit
node_modules\.bin\tsc.cmd --noEmit -p tests\tsconfig.json
```

Expected: 11 focused tests pass and both compilers exit 0.

- [ ] **Step 2: Run the full unit suite with the explicit local binary.**

```powershell
node_modules\.bin\vitest.cmd run --project unit
```

Expected: all unit files and tests pass. The previously diagnosed Phase B
progress-heading anchor must remain repaired.

- [ ] **Step 3: Run contract and Worker suites.**

```powershell
node_modules\.bin\vitest.cmd run --project contract
node_modules\.bin\vitest.cmd run --project worker
```

Expected: both projects pass without any Google event-write request.

- [ ] **Step 4: Run docs, build, and security checks through direct local tools.**

```powershell
node_modules\.bin\tsx.cmd scripts\validate-doc-coverage.ts
node_modules\.bin\vite.cmd build
node_modules\.bin\tsx.cmd scripts\validate-production-crypto-boundary.ts
node_modules\.bin\tsx.cmd scripts\capture-release-evidence.ts
node_modules\.bin\tsx.cmd scripts\scan-release.ts
git diff --check
git status --short
```

Expected: every command exits 0, the build succeeds, the security scan emits
no finding, and the final status contains no unexpected files. Do not deploy,
push, or request live Google acceptance for this no-provider-mutation
increment.

- [ ] **Step 5: Commit only after fresh verification.**

```powershell
git log -3 --oneline
git status --short
```

Expected: the branch contains the scoped Phase C commits and no uncommitted
tracked changes. Do not claim Phase C complete; report this increment as the
verified contract foundation and identify one-off create as the next scope.

## Self-review checklist

- [ ] Every requirement in `docs/superpowers/specs/2026-08-16-phase-c-write-pipeline-contracts-design.md` maps to a task above.
- [ ] No production file is added without a focused test and both documentation references.
- [ ] The plan never registers a provider write route or calls Google.
- [ ] The state transition names and status values are consistent across the test, implementation, docs, and handoff.
- [ ] The retained Phase B `## Current milestone` anchor remains covered by its cleanup test.
- [ ] Agent concurrency stays at or below 20, with inline execution preferred.
