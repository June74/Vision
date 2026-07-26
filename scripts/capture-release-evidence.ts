/** Generates fresh, build-bound privacy evidence through Vision's production boundaries. */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditWriter } from "../src/audit/audit-writer";
import {
  createBackupEncryptionKey,
  encryptBackupEnvelope,
} from "../src/crypto/backup-envelope";
import { prepareStoredEventRow } from "../src/data/repositories/event-repository";
import type { KeyProvider } from "../src/crypto/key-provider";
import { ProviderOrderKeySchema } from "../src/domain/events/event";
import { parseCalendarSyncMessage } from "../src/jobs/queue-message";
import { logEvent, type SafeLogEvent } from "../src/server/logging";
import {
  computeReleaseBuildDigest,
  PROTECTED_RELEASE_SENTINEL,
} from "./scan-release";

const EVIDENCE_GENERATOR = "scripts/capture-release-evidence.ts";
const RELEASE_EVIDENCE_ROOT = "dist/release-evidence";
const encoder = new TextEncoder();

interface EvidenceContext {
  readonly projectRoot: string;
  readonly runId: string;
  readonly capturedAt: string;
  readonly buildDigest: string;
}

/** Writes one generated record beneath the bounded release-evidence directory. */
async function writeEvidenceRecord(
  context: EvidenceContext,
  relativePath: string,
  surface: string,
  source: string,
  record: Readonly<object>,
): Promise<void> {
  const evidenceRoot = resolve(context.projectRoot, RELEASE_EVIDENCE_ROOT);
  const path = resolve(evidenceRoot, relativePath);
  const bounded = relative(evidenceRoot, path).replaceAll("\\", "/");
  if (
    bounded.startsWith("../") ||
    bounded === ".." ||
    !/^[A-Za-z0-9._/-]+$/u.test(bounded)
  ) {
    throw new Error("Release evidence path is outside the bounded directory.");
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({
      evidenceVersion: 1,
      surface,
      capturedAt: context.capturedAt,
      buildDigest: context.buildDigest,
      provenance: {
        generator: EVIDENCE_GENERATOR,
        runId: context.runId,
        source,
      },
      record,
    })}\n`,
    "utf8",
  );
}

/** Converts an encrypted binary column into its canonical non-plaintext export form. */
function encodeEncryptedColumn(value: Uint8Array | null): string | null {
  return value === null ? null : Buffer.from(value).toString("base64url");
}

/** Captures all five required release surfaces and writes the manifest last. */
export async function captureReleaseEvidence(
  projectRoot = process.cwd(),
): Promise<void> {
  const root = resolve(projectRoot);
  const context: EvidenceContext = {
    projectRoot: root,
    runId: randomUUID(),
    capturedAt: new Date().toISOString(),
    buildDigest: await computeReleaseBuildDigest(root),
  };

  let safeApplicationEvent: SafeLogEvent | undefined;
  logEvent(
    (event) => {
      safeApplicationEvent = event;
    },
    {
      requestId: "release-evidence",
      action: "release.evidence.capture",
      outcome: "succeeded",
      provider: "vision",
    },
  );
  if (!safeApplicationEvent) {
    throw new Error("Safe logger did not emit release evidence.");
  }
  await writeEvidenceRecord(
    context,
    "application-logs/captured.ndjson",
    "application_logs",
    "src/server/logging.ts#logEvent",
    safeApplicationEvent,
  );

  let serializedAudit = "";
  const auditWriter = new AuditWriter({
    /** Captures the already validated serialized audit value in memory. */
    async append(value) {
      serializedAudit = value;
    },
  });
  await auditWriter.write({
    id: "release_evidence",
    ownerId: "private_user",
    action: "release.evidence.capture",
    actorType: "system",
    occurredAt: context.capturedAt,
    outcome: "succeeded",
    provider: "vision",
  });
  const auditRecord = JSON.parse(serializedAudit) as Record<string, unknown>;
  await writeEvidenceRecord(
    context,
    "audit/audit.ndjson",
    "audit",
    "src/audit/audit-writer.ts#AuditWriter.write",
    auditRecord,
  );

  const queueRecord = parseCalendarSyncMessage({
    jobId: "release-evidence",
    ownerId: "private-user",
    calendarId: "vision-secondary-calendar",
    reason: "repair",
  });
  await writeEvidenceRecord(
    context,
    "queue/queue.ndjson",
    "queue",
    "src/jobs/queue-message.ts#parseCalendarSyncMessage",
    queueRecord,
  );

  const dataKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const keyProvider: KeyProvider = {
    /** Returns the non-extractable capture-only data key. */
    async getDataKey() {
      return { key: dataKey, keyVersion: 1 };
    },
  };
  const storedEvent = await prepareStoredEventRow(
    {
      nodeId: "release-evidence-event",
      ownerId: "private-user",
      identity: {
        sourceSystem: "google",
        sourceCalendarId: "vision-secondary-calendar",
        sourceEventId: "release-evidence-event",
        sourceVersion: ProviderOrderKeySchema.parse(
          "00000000000000000001",
        ),
      },
      startsAt: "2026-01-01T09:00:00.000Z",
      endsAt: "2026-01-01T10:00:00.000Z",
      timeZone: "UTC",
      busy: true,
      status: "confirmed",
      domain: "personal",
      domainState: "confirmed",
      privacy: "private",
      version: 1,
      title: PROTECTED_RELEASE_SENTINEL,
      description: PROTECTED_RELEASE_SENTINEL,
      attendees: [PROTECTED_RELEASE_SENTINEL],
      location: PROTECTED_RELEASE_SENTINEL,
      meetingLink: PROTECTED_RELEASE_SENTINEL,
    },
    keyProvider,
  );
  await writeEvidenceRecord(
    context,
    "database-raw/rows.ndjson",
    "database_raw",
    "src/data/repositories/event-repository.ts#prepareStoredEventRow",
    {
      nodeId: storedEvent.nodeId,
      ownerId: storedEvent.ownerId,
      titleEnvelope: encodeEncryptedColumn(storedEvent.titleEnvelope),
      descriptionEnvelope: encodeEncryptedColumn(
        storedEvent.descriptionEnvelope,
      ),
      attendeesEnvelope: encodeEncryptedColumn(
        storedEvent.attendeesEnvelope,
      ),
      locationEnvelope: encodeEncryptedColumn(
        storedEvent.locationEnvelope,
      ),
      meetingLinkEnvelope: encodeEncryptedColumn(
        storedEvent.meetingLinkEnvelope,
      ),
      protectedKeyVersion: storedEvent.protectedKeyVersion,
    },
  );

  const backupKey = createBackupEncryptionKey(
    await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    1,
  );
  const backupEnvelope = await encryptBackupEnvelope(
    encoder.encode(PROTECTED_RELEASE_SENTINEL),
    backupKey,
  );
  await writeEvidenceRecord(
    context,
    "r2-unencrypted/object.json",
    "r2_unencrypted",
    "src/crypto/backup-envelope.ts#encryptBackupEnvelope",
    { ...backupEnvelope },
  );

  const manifestPath = resolve(root, RELEASE_EVIDENCE_ROOT, "manifest.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      evidenceVersion: 1,
      generator: EVIDENCE_GENERATOR,
      runId: context.runId,
      capturedAt: context.capturedAt,
      buildDigest: context.buildDigest,
    }),
    "utf8",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await captureReleaseEvidence();
  console.log("Fresh release evidence captured.");
}
