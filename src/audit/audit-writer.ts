/** Serializes validated privacy-safe audit facts into an injected durable sink. */
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
  async write(event: SafeAuditEvent): Promise<void> {
    const safeEvent = validateSafeAuditEvent(event);
    await this.sink.append(JSON.stringify(safeEvent));
  }
}
