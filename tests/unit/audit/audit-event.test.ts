import { describe, expect, it } from "vitest";
import {
  SafeAuditEventValidationError,
  type SafeAuditEvent,
} from "../../../src/audit/audit-event";
import {
  AuditWriter,
  type AuditEventSink,
} from "../../../src/audit/audit-writer";

const SENTINEL = "VISION_PROTECTED_SENTINEL_7F9A";
const validAuditEvent = {
  id: "audit_1",
  ownerId: "owner_1",
  nodeId: "node_event_1",
  action: "event.saved",
  actorType: "system",
  occurredAt: "2026-07-23T12:00:00.000Z",
  outcome: "succeeded",
  provider: "google_calendar",
} satisfies SafeAuditEvent;

class RecordingAuditSink implements AuditEventSink {
  readonly serialized: string[] = [];

  async append(serializedEvent: string): Promise<void> {
    this.serialized.push(serializedEvent);
  }
}

describe("privacy-safe audit event", () => {
  it("serializes only the closed audit allowlist", async () => {
    const sink = new RecordingAuditSink();
    const writer = new AuditWriter(sink);

    await writer.write(validAuditEvent);

    expect(sink.serialized).toHaveLength(1);
    expect(JSON.parse(sink.serialized[0]!)).toEqual(validAuditEvent);
    expect(sink.serialized[0]).not.toContain(SENTINEL);
  });

  it.each([
    "title",
    "description",
    "noteBody",
    "attendees",
    "token",
    "content",
    "location",
    "meetingLink",
    "retainedAiContent",
  ])("rejects protected audit key %s before serialization", async (protectedKey) => {
    const sink = new RecordingAuditSink();
    const writer = new AuditWriter(sink);
    const unsafe = { ...validAuditEvent, [protectedKey]: SENTINEL };

    const error = await writer.write(unsafe as SafeAuditEvent).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SafeAuditEventValidationError);
    expect(JSON.stringify(error)).not.toContain(SENTINEL);
    expect(sink.serialized).toEqual([]);
  });

  it("rejects symbol, hidden, inherited, accessor, and nested payloads without reading them", async () => {
    const sink = new RecordingAuditSink();
    const writer = new AuditWriter(sink);
    let getterReads = 0;
    const symbolEvent = { ...validAuditEvent };
    Object.defineProperty(symbolEvent, Symbol("title"), { enumerable: true, value: SENTINEL });
    const hiddenEvent = { ...validAuditEvent };
    Object.defineProperty(hiddenEvent, "description", { enumerable: false, value: SENTINEL });
    const inheritedEvent = Object.assign(Object.create({ token: SENTINEL }), validAuditEvent);
    const accessorEvent = { ...validAuditEvent };
    Object.defineProperty(accessorEvent, "provider", {
      enumerable: true,
      get: () => {
        getterReads += 1;
        return SENTINEL;
      },
    });
    const nestedEvent = { ...validAuditEvent, payload: { content: SENTINEL } };

    for (const event of [symbolEvent, hiddenEvent, inheritedEvent, accessorEvent, nestedEvent]) {
      await expect(writer.write(event as SafeAuditEvent)).rejects.toBeInstanceOf(
        SafeAuditEventValidationError,
      );
    }

    expect(getterReads).toBe(0);
    expect(sink.serialized).toEqual([]);
  });

  it("rejects protected content smuggled through an allowlisted value", async () => {
    const sink = new RecordingAuditSink();
    const writer = new AuditWriter(sink);

    await expect(
      writer.write({ ...validAuditEvent, errorCategory: SENTINEL }),
    ).rejects.toBeInstanceOf(SafeAuditEventValidationError);
    expect(sink.serialized).toEqual([]);
  });

  it("rejects Object.prototype pollution without invoking inherited getters and restores the prototype", async () => {
    const sink = new RecordingAuditSink();
    const writer = new AuditWriter(sink);
    let getterReads = 0;
    let caught: unknown;
    Object.defineProperty(Object.prototype, "provider", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterReads += 1;
        return "polluted_provider";
      },
    });
    Object.defineProperty(Object.prototype, "title", {
      configurable: true,
      enumerable: true,
      value: SENTINEL,
    });

    try {
      const withoutOwnProvider = { ...validAuditEvent };
      delete (withoutOwnProvider as { provider?: string }).provider;
      try {
        await writer.write(withoutOwnProvider);
      } catch (error) {
        caught = error;
      }
    } finally {
      delete (Object.prototype as { provider?: unknown }).provider;
      delete (Object.prototype as { title?: unknown }).title;
    }
    expect(caught).toBeInstanceOf(SafeAuditEventValidationError);
    expect(getterReads).toBe(0);
    expect(sink.serialized).toEqual([]);
  });
});

if (false) {
  const audit: SafeAuditEvent = validAuditEvent;
  const writer = new AuditWriter(new RecordingAuditSink());
  const unsafeVariable = { ...audit, title: SENTINEL };
  // @ts-expect-error variables with protected extra keys are rejected, not only fresh object literals
  void writer.write(unsafeVariable);
  const compileTimeRejections: SafeAuditEvent[] = [
    {
      ...audit,
      // @ts-expect-error protected titles are outside the closed audit type
      title: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected descriptions are outside the closed audit type
      description: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected note bodies are outside the closed audit type
      noteBody: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected attendees are outside the closed audit type
      attendees: [SENTINEL],
    },
    {
      ...audit,
      // @ts-expect-error protected tokens are outside the closed audit type
      token: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected content is outside the closed audit type
      content: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected locations are outside the closed audit type
      location: SENTINEL,
    },
    {
      ...audit,
      // @ts-expect-error protected meeting links are outside the closed audit type
      meetingLink: SENTINEL,
    },
  ];
  void compileTimeRejections;
}
