/** Serializes validated privacy-safe audit facts into an injected durable sink. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "../data/db";
import {
  validateSafeAuditEvent,
  type SafeAuditEvent,
} from "./audit-event";

/** Append-only persistence boundary that receives already-validated serialized audit facts. */
export interface AuditEventSink {
  append(serializedEvent: string): Promise<void>;
}

/** Writes only the closed audit contract and never serializes a rejected input. */
export class AuditWriter {
  constructor(private readonly sink: AuditEventSink) {}

  /** Validates, serializes, and appends one privacy-safe audit record. */
  async write<T extends SafeAuditEvent>(
    event: T & Record<Exclude<keyof T, keyof SafeAuditEvent>, never>,
  ): Promise<void> {
    const safeEvent = validateSafeAuditEvent(event);
    await this.sink.append(JSON.stringify(safeEvent));
  }
}

/** Durable Drizzle/Neon sink that revalidates serialized facts before one PostgreSQL insert. */
export class DrizzleAuditEventSink implements AuditEventSink {
  constructor(private readonly database: VisionDatabase) {}

  /** Parses, revalidates, and inserts one closed audit record without free-form columns. */
  async append(serializedEvent: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serializedEvent) as unknown;
    } catch {
      parsed = undefined;
    }
    const event = validateSafeAuditEvent(parsed);
    await this.database.execute(sql`
      insert into audit_events (
        id, owner_id, node_id, actor_type, action, outcome, provider, error_category, occurred_at
      ) values (
        ${event.id}, ${event.ownerId}, ${event.nodeId ?? null}, ${event.actorType},
        ${event.action}, ${event.outcome}, ${event.provider ?? null},
        ${event.errorCategory ?? null}, ${new Date(event.occurredAt)}
      )
    `);
  }
}

/** Wires the validated writer to the durable production Drizzle/Neon sink. */
export function createAuditWriter(database: VisionDatabase): AuditWriter {
  return new AuditWriter(new DrizzleAuditEventSink(database));
}
