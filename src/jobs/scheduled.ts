/** Coordinates periodic channel renewal and missed-notification repair. */
import { createDb } from "../data/db";
import { Pool } from "@neondatabase/serverless";
import {
  createPhaseBAiUsageSource,
  createPhaseBNonAiReadSource,
} from "../data/phase-b-ai-usage-source";
import {
  createPhaseBFoundationProbeSource,
  createR2PhaseBFoundationProbeBucket,
  type PhaseBFoundationProbeClientPort,
} from "../data/phase-b-foundation-probe";
import { createChannelMaintenanceRepository } from "../data/repositories/channel-maintenance-repository";
import { createProjectionRepository } from "../data/repositories/projection-repository";
import {
  DrizzleTokenStore,
  DrizzleWrappedDataKeyStore,
  EncryptedTokenRepository,
  type TokenRepositoryPort,
} from "../data/repositories/token-repository";
import { importBackupEncryptionKey } from "../crypto/backup-key";
import {
  encodeBase64Url,
  parseCipherEnvelope,
  serializeCipherEnvelope,
} from "../crypto/envelope";
import { createWrappedKeyProvider } from "../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../crypto/protected-fields";
import {
  createNeonBackupSnapshotSource,
} from "../data/backup/neon-adapter";
import { createR2BackupObjectStore } from "../data/backup/r2-object-store";
import { createR2BackupObjectCatalogReader } from "../data/backup/r2-backup-object-reader";
import { createR2RestoreAttemptStore } from "../data/backup/r2-restore-attempt-store";
import { createTemporaryPreviewRoleProbeAdapter } from "../data/backup/temporary-preview-role-probe-adapter";
import { CalendarClient } from "../integrations/google-calendar/calendar-client";
import {
  GoogleOAuthClient,
} from "../integrations/google/oauth-client";
import {
  parseGoogleAuthEnvironment,
  parseBackupEnvironment,
  parseVisionKeyEncryptionKey,
  type Env,
} from "../server/env";
import { PHASE_B_PRIVILEGE_MANIFEST } from "../domain/operations/phase-b-privilege-manifest";
import {
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  assertTemporaryPreviewAcceptanceLifetime,
  parseTemporaryPreviewAcceptanceAiGatewayAttestation,
  parseTemporaryPreviewAcceptanceSelector,
  type TemporaryPreviewFaultScenario,
} from "../domain/operations/temporary-preview-fault";
import { createDailyBackup } from "./create-daily-backup";
import {
  runTemporaryPreviewFault,
  TEMPORARY_PREVIEW_FAULT_CRON,
  type TemporaryPreviewFaultEntry,
} from "./temporary-preview-fault";
import type { BackupObjectWriter } from "./create-daily-backup";
import {
  emitPhaseBAiUsageEvidence,
  runPhaseBAiUsageEvidence,
  type PhaseBAiUsageEvidenceDependencies,
  type PhaseBAiUsageEvidenceEntry,
} from "./phase-b-ai-usage-evidence";
import {
  emitPhaseBFoundationProbeEvidence,
  runPhaseBFoundationProbe,
} from "./phase-b-foundation-probe";
import {
  createCalendarMaintenanceEvidence,
  emitCalendarMaintenanceEvidence,
  type CalendarMaintenanceEvidenceEntry,
  type CalendarMaintenanceRenewalOutcome,
  type CalendarMaintenanceRepairOutcome,
} from "./calendar-maintenance-evidence";
import { purgeExpiredBackups } from "./purge-expired-backups";
import {
  renewExpiringChannels,
  type RenewExpiringChannelsOutcome,
} from "./renew-google-channels";
import {
  repairCalendarSync,
  type RepairCalendarSyncOutcome,
} from "./repair-calendar-sync";
import {
  classifyGoogleRefreshError,
} from "./queue-consumer";
import { SyncCalendarError } from "./sync-calendar";
import {
  runTemporaryPreviewRoleProbe,
  TEMPORARY_PREVIEW_ROLE_PROBE_CRON,
  type TemporaryPreviewRoleProbeDependencies,
  type TemporaryPreviewRoleProbeEvidence,
} from "./temporary-preview-role-probe";
import { runProductionTemporaryPreviewRestore } from "./temporary-preview-restore-production";

/** Existing near-real-time repair/renewal cadence. */
export const CALENDAR_MAINTENANCE_CRON = "*/15 * * * *";
/** Daily UTC recovery cadence kept separate from provider maintenance. */
export const DAILY_BACKUP_CRON = "5 6 * * *";

/** Replaceable dispatch boundaries proving each cron owns only its intended job. */
export interface ScheduledJobDependencies {
  readonly maintenance: (now: Date) => Promise<void>;
  readonly recovery: (now: Date) => Promise<void>;
  readonly temporaryRoleProbe: (now: Date) => Promise<void>;
  readonly temporaryRestore?: (now: Date) => Promise<void>;
  /**
   * Typed candidate boundary only. Task 6 owns its future generated selector
   * and one-minute routing; normal committed schedules never dispatch it.
   */
  readonly foundationProbe: (now: Date) => Promise<void>;
  /**
   * Runnable Task 4 candidate boundary. Task 6 alone binds this member to its
   * generated selector and one-minute cron.
   */
  readonly aiUsageEvidence: (now: Date) => Promise<void>;
}

/** Recovery operations kept separate so retention can run only after verified creation. */
export interface ScheduledRecoveryDependencies {
  readonly create: (now: Date) => Promise<void>;
  /** Candidate-only writer seam; ordinary recovery always uses the default object writer. */
  readonly createWithWriter?: (
    now: Date,
    writer: import("./create-daily-backup").BackupObjectWriter,
  ) => Promise<void>;
  readonly purge: (now: Date) => Promise<void>;
}

/** Injected scheduled-entry boundaries keep candidate dispatch testable without provider I/O. */
export interface ScheduledEntryDependencies extends ScheduledJobDependencies {
  /** Execution clock used to enforce every temporary candidate invocation's real lifetime. */
  readonly currentTime: () => Date;
  readonly temporaryFaultR2Upload: (
    now: Date,
    writer: BackupObjectWriter,
  ) => Promise<void>;
  readonly writeTemporaryFaultEvidence: (
    entry: TemporaryPreviewFaultEntry,
  ) => void;
}

/** Routes exact configured cron expressions without coupling recovery to Google credentials. */
export async function runScheduledJob(
  cron: string,
  now: Date,
  dependencies: ScheduledJobDependencies,
): Promise<void> {
  if (cron === CALENDAR_MAINTENANCE_CRON) {
    await dependencies.maintenance(now);
    return;
  }
  if (cron === DAILY_BACKUP_CRON) {
    await dependencies.recovery(now);
    return;
  }
  if (cron === TEMPORARY_PREVIEW_ROLE_PROBE_CRON) {
    await dependencies.temporaryRoleProbe(now);
    return;
  }
  throw new Error("Scheduled cron is unsupported.");
}

/** Creates and verifies today's backup before applying the fixed retention window. */
export async function runScheduledRecovery(
  now: Date,
  dependencies: ScheduledRecoveryDependencies,
): Promise<void> {
  await dependencies.create(now);
  await dependencies.purge(now);
}

/** Creates the read-only AI candidate dependencies from one admitted boolean. */
export function createScheduledPhaseBAiUsageEvidenceDependencies(
  database: ReturnType<typeof createDb>,
  ownerId: string,
  gatewayLimitMatches: boolean,
): PhaseBAiUsageEvidenceDependencies {
  if (gatewayLimitMatches !== true) {
    throw new Error("Phase B AI usage candidate is unavailable.");
  }
  const usage = createPhaseBAiUsageSource(database, ownerId);
  const nonAi = createPhaseBNonAiReadSource(database, ownerId);
  return Object.freeze({
    read: usage.read,
    readStatus: nonAi.readStatus,
    readCalendar: nonAi.readCalendar,
    gatewayLimitMatches: true,
  });
}

/** Builds only the preview AI candidate's owner-scoped read dependencies. */
export async function createProductionScheduledPhaseBAiUsageEvidenceDependencies(
  environment: Env,
  gatewayLimitMatches: boolean,
): Promise<PhaseBAiUsageEvidenceDependencies> {
  if (
    environment.VISION_ENV !== "preview" ||
    gatewayLimitMatches !== true
  ) {
    throw new Error("Phase B AI usage candidate is unavailable.");
  }
  const googleSubject = readScheduledOwnerSubject(
    environment.GOOGLE_ALLOWED_SUB,
  );
  const ownerId = await deriveOwnerId(googleSubject);
  return createScheduledPhaseBAiUsageEvidenceDependencies(
    createDb(environment.DATABASE_URL),
    ownerId,
    gatewayLimitMatches,
  );
}

/** Runs and emits exactly one terminal AI record for an admitted candidate. */
export async function runScheduledPhaseBAiUsageEvidence(
  now: Date,
  dependencies: PhaseBAiUsageEvidenceDependencies,
  write: (entry: PhaseBAiUsageEvidenceEntry) => void = console.info,
): Promise<void> {
  const evidence = await runPhaseBAiUsageEvidence(now, dependencies);
  emitPhaseBAiUsageEvidence(evidence, write);
  if (evidence.outcome !== "succeeded") {
    throw new Error("Phase B AI usage evidence failed.");
  }
}

/** Emits only the fixed role-probe action and its already-closed evidence. */
export function emitTemporaryPreviewRoleProbeEvidence(
  evidence: TemporaryPreviewRoleProbeEvidence,
  write: (entry: {
    readonly action: "backup.restore-role-probe";
    readonly evidence: TemporaryPreviewRoleProbeEvidence;
  }) => void = console.info,
): void {
  write({ action: "backup.restore-role-probe", evidence });
}

/** Injected maintenance functions keep the scheduler free of event-fetching capability. */
export interface ScheduledCalendarMaintenanceDependencies {
  /** Removes only expired nonactivated rebuild staging; it never reads provider events or OAuth credentials. */
  readonly cleanupProjectionRebuilds?: (now: Date) => Promise<number>;
  readonly renew: (now: Date) => Promise<RenewExpiringChannelsOutcome>;
  readonly repair: (now: Date) => Promise<RepairCalendarSyncOutcome>;
  /** Persists typed OAuth failure against only the maintained checkpoint generation. */
  readonly recordCredentialFailure?: (
    failure: SyncCalendarError,
    now: Date,
  ) => Promise<boolean>;
  /** Clears only a scheduler-owned retry marker after credentials recover. */
  readonly clearCredentialRetry?: (now: Date) => Promise<boolean>;
  /** Replaceable write seam; the coordinator still constructs the fixed action. */
  readonly writeEvidence?: (entry: CalendarMaintenanceEvidenceEntry) => void;
}

/** Narrow credential boundary used by production renewal and adversarial tests. */
export interface ScheduledGoogleCredentialDependencies {
  readonly googleSubject: string;
  readonly tokens: Pick<
    TokenRepositoryPort,
    "getGoogleTokens" | "saveRefreshedAccessToken"
  >;
  /** Calls the refresh-only Google OAuth boundary. */
  readonly refreshAccessToken: (
    refreshToken: string,
  ) => Promise<{
    readonly accessToken: string;
    readonly expiresInSeconds: number;
    readonly scopes?: readonly string[];
  }>;
  /** Supplies one stable scheduler time for expiry and persistence comparisons. */
  readonly now?: () => Date;
}

/** Reserves repair first so renewal failure cannot suppress durable recovery work. */
export async function runScheduledCalendarMaintenance(
  now: Date,
  dependencies: ScheduledCalendarMaintenanceDependencies,
): Promise<void> {
  let cleanupFailure: unknown;
  let repairFailure: unknown;
  let renewalFailure: unknown;
  let repairOutcome: CalendarMaintenanceRepairOutcome = "no_work";
  let renewalOutcome: CalendarMaintenanceRenewalOutcome = "no_work";
  try {
    await dependencies.cleanupProjectionRebuilds?.(now);
  } catch (error) {
    cleanupFailure = error;
  }
  try {
    repairOutcome = await dependencies.repair(now);
  } catch (error) {
    repairFailure = error;
  }
  try {
    renewalOutcome = await dependencies.renew(now);
    await dependencies.clearCredentialRetry?.(now);
  } catch (error) {
    renewalFailure = error;
    if (
      error instanceof SyncCalendarError &&
      dependencies.recordCredentialFailure
    ) {
      try {
        await dependencies.recordCredentialFailure(error, now);
      } catch (dispositionFailure) {
        renewalFailure = dispositionFailure;
      }
    }
  }
  const evidence = createCalendarMaintenanceEvidence(
    now,
    cleanupFailure !== undefined || repairFailure !== undefined
      ? "failed"
      : repairOutcome,
    renewalFailure !== undefined ? "failed" : renewalOutcome,
  );
  let writerFailure: unknown;
  try {
    emitCalendarMaintenanceEvidence(evidence, dependencies.writeEvidence);
  } catch (error) {
    writerFailure = error;
  }
  if (cleanupFailure !== undefined) throw cleanupFailure;
  if (repairFailure !== undefined) throw repairFailure;
  if (renewalFailure !== undefined) throw renewalFailure;
  if (writerFailure !== undefined) throw writerFailure;
}

/** Cloudflare scheduled entry point routing maintenance and recovery by exact cron expression. */
export async function scheduled(
  controller: ScheduledController,
  environment: Env,
  _context: ExecutionContext,
  providedDependencies?: ScheduledEntryDependencies,
  productionFactory: (
    environment: Env,
  ) => ScheduledEntryDependencies = createProductionScheduledEntryDependencies,
): Promise<void> {
  const scheduledAt = new Date(controller.scheduledTime);
  const selector = parseTemporaryPreviewAcceptanceSelector(environment);
  const dependencies =
    providedDependencies ?? productionFactory(environment);
  if (selector !== undefined) {
    assertTemporaryPreviewAcceptanceLifetime(
      dependencies.currentTime(),
      environment,
    );
  } else if (environment.PREVIEW_ACCEPTANCE_EXPIRES_AT !== undefined) {
    throw new Error("Temporary preview acceptance candidate is invalid.");
  }
  const gatewayLimitMatches =
    parseTemporaryPreviewAcceptanceAiGatewayAttestation(environment);

  if (controller.cron === TEMPORARY_PREVIEW_FAULT_CRON) {
    if (
      TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
        selector as TemporaryPreviewFaultScenario,
      )
    ) {
      await runTemporaryPreviewFault(
        environment,
        {
          /** Delegates only the admitted R2 candidate to the injected scheduled boundary. */
          runR2Upload: (writer) =>
            dependencies.temporaryFaultR2Upload(scheduledAt, writer),
        },
        dependencies.writeTemporaryFaultEvidence,
      );
      return;
    }
    if (selector === "foundation_probe") {
      await dependencies.foundationProbe(scheduledAt);
      return;
    }
    if (selector === "role_probe") {
      await dependencies.temporaryRoleProbe(scheduledAt);
      return;
    }
    if (selector === "restore") {
      if (!dependencies.temporaryRestore) {
        throw new Error("Temporary preview candidate is invalid.");
      }
      await dependencies.temporaryRestore(scheduledAt);
      return;
    }
    if (selector === "ai_usage" && gatewayLimitMatches) {
      await dependencies.aiUsageEvidence(scheduledAt);
      return;
    }
    throw new Error("Temporary preview candidate is invalid.");
  }
  await runScheduledJob(controller.cron, scheduledAt, dependencies);
}

/** Creates lazy production closures only after scheduled candidate selection. */
export function createProductionScheduledEntryDependencies(
  environment: Env,
): ScheduledEntryDependencies {
  return {
    /** Uses wall-clock execution time so delayed delivery cannot outlive a candidate. */
    currentTime: () => new Date(),
    /** Builds Google maintenance capability only for the maintenance cron. */
    maintenance: async (scheduledAt) => {
      const dependencies =
        await createProductionScheduledCalendarMaintenanceDependencies(
          environment,
        );
      await runScheduledCalendarMaintenance(scheduledAt, dependencies);
    },
    /** Builds backup capability only for the daily recovery cron. */
    recovery: async (scheduledAt) => {
      const dependencies =
        await createProductionScheduledRecoveryDependencies(environment);
      await runScheduledRecovery(scheduledAt, dependencies);
    },
    /** Builds only the preview read probe for the temporary cron. */
    temporaryRoleProbe: async () => {
      const evidence = await runTemporaryPreviewRoleProbe(
        {
          VISION_ENV: environment.VISION_ENV,
          PREVIEW_RESTORE_DATABASE_URL:
            environment.PREVIEW_RESTORE_DATABASE_URL,
        },
        createProductionTemporaryRoleProbeDependencies(),
      );
      emitTemporaryPreviewRoleProbeEvidence(evidence);
      if (evidence.outcome !== "succeeded") {
        throw new Error("Temporary preview role probe failed.");
      }
    },
    /** Constructs only the gated temporary restore boundary. */
    temporaryRestore: async () => {
      if (
        environment.VISION_ENV !== "preview" ||
        typeof environment.PREVIEW_RESTORE_DATABASE_URL !== "string" ||
        typeof environment.PREVIEW_RESTORE_TARGET_ID !== "string" ||
        environment.BACKUP_BUCKET === undefined
      ) {
        throw new Error("Temporary preview restore adapter is unavailable.");
      }
      const backupEnvironment = parseBackupEnvironment(environment);
      const catalogReader = createR2BackupObjectCatalogReader(
        environment.BACKUP_BUCKET,
      );
      const attemptStore = createR2RestoreAttemptStore(
        environment.BACKUP_BUCKET,
      );
      const databaseUrl = environment.PREVIEW_RESTORE_DATABASE_URL;
      const targetId = environment.PREVIEW_RESTORE_TARGET_ID;
      const evidence = await runProductionTemporaryPreviewRestore({
        VISION_ENV: "preview",
        PREVIEW_RESTORE_DATABASE_URL: databaseUrl,
        PREVIEW_RESTORE_TARGET_ID: targetId,
        BACKUP_ENCRYPTION_KEY:
          backupEnvironment.BACKUP_ENCRYPTION_KEY,
        BACKUP_KEY_VERSION: String(
          backupEnvironment.BACKUP_KEY_VERSION,
        ),
        catalogReader,
        attemptFence: Object.freeze({
          claimOnce: attemptStore.claimOnce.bind(attemptStore),
        }),
      });
      console.info({ action: "backup.restore", evidence });
      if (evidence.outcome !== "succeeded") {
        throw new Error("Temporary preview restore failed.");
      }
    },
    /** Builds only the preview foundation candidate's aggregate read boundaries. */
    foundationProbe: async (scheduledAt) => {
      await runProductionScheduledPhaseBFoundationProbe(
        environment,
        scheduledAt,
      );
    },
    /** Builds the AI source only after the generated same-run attestation is admitted. */
    aiUsageEvidence: async (scheduledAt) => {
      const dependencies =
        await createProductionScheduledPhaseBAiUsageEvidenceDependencies(
          environment,
          parseTemporaryPreviewAcceptanceAiGatewayAttestation(environment),
        );
      await runScheduledPhaseBAiUsageEvidence(
        scheduledAt,
        dependencies,
      );
    },
    /** Builds the normal backup path only after the preview binding has been admitted. */
    temporaryFaultR2Upload: async (scheduledAt, writer) => {
      const recovery =
        await createProductionScheduledRecoveryDependencies(environment);
      if (!recovery.createWithWriter) {
        throw new Error("Temporary preview fault is unavailable.");
      }
      await recovery.createWithWriter(scheduledAt, writer);
    },
    /** Emits only the closed four-key candidate evidence envelope. */
    writeTemporaryFaultEvidence: (entry) => console.info(entry),
  };
}

/** Creates only the max-one read adapter required by the preview probe. */
function createProductionTemporaryRoleProbeDependencies(): TemporaryPreviewRoleProbeDependencies {
  return {
    /** Opens, reads, and closes only the temporary max-one role-probe adapter. */
    probeRole: (connectionString) =>
      createTemporaryPreviewRoleProbeAdapter(connectionString).probeRole(),
  };
}

/** Runs the dedicated foundation candidate with one max-one pool and read-only R2 port. */
async function runProductionScheduledPhaseBFoundationProbe(
  environment: Env,
  scheduledAt: Date,
): Promise<void> {
  if (environment.VISION_ENV !== "preview" || !environment.BACKUP_BUCKET) {
    throw new Error("Phase B foundation probe candidate is unavailable.");
  }
  const ownerId = await deriveOwnerId(
    readScheduledOwnerSubject(environment.GOOGLE_ALLOWED_SUB),
  );
  const database = createDb(environment.DATABASE_URL);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    max: 1,
  });
  const source = createPhaseBFoundationProbeSource({
    pool: {
      /** Retains one client and exposes only the parameterized query port. */
      async connect(): Promise<PhaseBFoundationProbeClientPort> {
        const client = await pool.connect();
        return {
          /** Returns rows only; no driver metadata crosses the probe boundary. */
          async query<Row extends Record<string, unknown>>(
            statement: string,
            parameters: readonly unknown[],
          ) {
            const result = await client.query(statement, [...parameters]);
            return { rows: result.rows as readonly Row[] };
          },
          /** Returns the retained client to the max-one pool. */
          release: () => client.release(),
        };
      },
      /** Closes the dedicated pool after the probe finishes. */
      end: () => pool.end(),
    },
    bucket: createR2PhaseBFoundationProbeBucket(environment.BACKUP_BUCKET),
    privilegeManifest: PHASE_B_PRIVILEGE_MANIFEST,
    ownerId,
    /** Decrypts only the controlled title and returns mutable bytes for caller zeroization. */
    decryptControlledTitle: async (candidate) => {
      const serialized = new TextDecoder("utf-8", { fatal: true }).decode(
        candidate.titleEnvelope,
      );
      const decrypted = await decryptProtectedFields(
        keyProvider,
        {
          ownerId: candidate.ownerId,
          nodeId: candidate.nodeId,
          domain: candidate.domain,
        },
        { title: parseCipherEnvelope(serialized) },
      );
      return new TextEncoder().encode(decrypted.title ?? "");
    },
  });
  const evidence = await runPhaseBFoundationProbe(
    { VISION_ENV: "preview" },
    scheduledAt,
    source,
  );
  emitPhaseBFoundationProbeEvidence(evidence);
  if (evidence.outcome !== "succeeded") {
    throw new Error("Phase B foundation probe failed.");
  }
}

/** Creates backup-only production functions without opening Google credential paths. */
async function createProductionScheduledRecoveryDependencies(
  environment: Env,
): Promise<ScheduledRecoveryDependencies> {
  if (!environment.BACKUP_BUCKET) {
    throw new Error("Backup object storage is unavailable.");
  }
  const backupEnvironment = parseBackupEnvironment(environment);
  const backupKey = await importBackupEncryptionKey(
    backupEnvironment.BACKUP_ENCRYPTION_KEY,
    backupEnvironment.BACKUP_KEY_VERSION,
  );
  const store = createR2BackupObjectStore(environment.BACKUP_BUCKET);
  const snapshotSource = createNeonBackupSnapshotSource(
    environment.DATABASE_URL,
  );
  return {
    /** Captures, encrypts, conditionally stores, and verifies today's backup. */
    create: async (now) => {
      await createDailyBackup(now, { store, snapshotSource, backupKey });
    },
    /** Replaces only the object writer while retaining normal snapshot and encryption reads. */
    createWithWriter: async (now, writer) => {
      await createDailyBackup(now, { store, snapshotSource, backupKey, writer });
    },
    /** Purges only validated objects outside the fixed recovery window. */
    purge: async (now) => {
      await purgeExpiredBackups(now, { store });
    },
  };
}

/** Creates owner-scoped renewal and repair functions from server-only runtime bindings. */
async function createProductionScheduledCalendarMaintenanceDependencies(
  environment: Env,
): Promise<ScheduledCalendarMaintenanceDependencies> {
  if (!environment.CALENDAR_SYNC_QUEUE) {
    throw new Error("Calendar synchronization queue is unavailable.");
  }
  const auth = parseGoogleAuthEnvironment(environment);
  const database = createDb(environment.DATABASE_URL);
  const ownerId = await deriveOwnerId(auth.GOOGLE_ALLOWED_SUB);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  const repository = createChannelMaintenanceRepository(database, ownerId);
  const projectionRepository = createProjectionRepository(
    database,
    keyProvider,
    ownerId,
  );
  const callbackUri = new URL("/webhooks/google/calendar", auth.GOOGLE_REDIRECT_URI)
    .toString();
  const tokens = new EncryptedTokenRepository(
    new DrizzleTokenStore(database),
    keyProvider,
    ownerId,
  );
  const oauth = new GoogleOAuthClient(
    {
      clientId: auth.GOOGLE_CLIENT_ID,
      clientSecret: auth.GOOGLE_CLIENT_SECRET,
      redirectUri: auth.GOOGLE_REDIRECT_URI,
    },
    fetch.bind(globalThis),
    {
      /** Rejects identity verification in this refresh-only background client. */
      async verify() {
        throw new Error("ID-token verification is unavailable.");
      },
    },
  );
  return {
    /** Purges only owner-scoped expired staging before any credential-dependent renewal begins. */
    cleanupProjectionRebuilds: (now) =>
      projectionRepository.cleanupExpired(now),
    /** Renews eligible provider channels using the lifecycle repository. */
    renew: async (now) => {
      const accessToken = await resolveScheduledGoogleAccessToken({
        googleSubject: auth.GOOGLE_ALLOWED_SUB,
        tokens,
        /** Refreshes through the configured Google OAuth client. */
        refreshAccessToken: (refreshToken) =>
          oauth.refreshAccessToken(refreshToken),
        /** Reuses the cron timestamp for deterministic expiry decisions. */
        now: () => now,
      });
      await repository.clearCredentialRetry(now);
      const client = new CalendarClient(
        accessToken,
        auth.GOOGLE_ALLOWED_SUB,
        fetch.bind(globalThis),
      );
      return renewExpiringChannels(now, {
        repository,
        provider: {
          /** Creates one exact Google event-watch channel. */
          watch: ({ calendarId, channelId, channelToken }) =>
            client.watchCalendar({
              calendarId,
              channelId,
              channelToken,
              callbackUri,
            }),
          /** Stops only the exact superseded Google channel and resource. */
          stop: (input) => client.stopChannel(input),
        },
        /** Creates a 192-bit opaque channel identifier. */
        createChannelId: () => randomOpaque(24),
        /** Creates a 256-bit secret callback token. */
        createChannelToken: () => randomOpaque(32),
        /** Creates a distinct durable renewal election lease. */
        createLeaseId: () => `lease_${randomOpaque(24)}`,
        hashToken: sha256Base64Url,
        /** Encrypts the recovery copy while retaining only a digest for lookup. */
        encryptToken: async (token, context) => {
          const encrypted = await encryptProtectedFields(
            keyProvider,
            {
              ownerId: context.ownerId,
              nodeId: context.rowId,
              domain: "personal",
            },
            { channelToken: token },
          );
          return new TextEncoder().encode(
            serializeCipherEnvelope(encrypted.channelToken!),
          );
        },
      });
    },
    /** Reserves stale-calendar repair through the normal opaque Queue. */
    repair: (now) =>
      repairCalendarSync(now, {
        repository,
        queue: environment.CALENDAR_SYNC_QUEUE!,
      }),
    /** Persists safe credential disposition without copying provider details. */
    recordCredentialFailure: (failure, now) =>
      repository.recordCredentialFailure(failure, now),
  };
}

/** Resolves a short-lived access token with Task 3's safe refresh classifications. */
export async function resolveScheduledGoogleAccessToken(
  input: ScheduledGoogleCredentialDependencies,
): Promise<string> {
  const now = input.now?.() ?? new Date();
  let retained;
  try {
    retained = await input.tokens.getGoogleTokens(input.googleSubject);
  } catch {
    throw new SyncCalendarError("database", "retry_scheduled", true, 5);
  }
  if (!retained) {
    throw new SyncCalendarError("authorization", "disconnected", false);
  }
  if (
    !retained.accessToken ||
    retained.accessExpiresAt.getTime() <= now.getTime() + 60_000
  ) {
    let refreshed;
    try {
      refreshed = await input.refreshAccessToken(retained.refreshToken);
    } catch (error) {
      throw classifyGoogleRefreshError(error);
    }
    const refreshedAt = now;
    try {
      retained = await input.tokens.saveRefreshedAccessToken(
        {
          googleSubject: input.googleSubject,
          accessToken: refreshed.accessToken,
          accessExpiresAt: new Date(
            refreshedAt.getTime() + refreshed.expiresInSeconds * 1_000,
          ),
          grantedScopes: refreshed.scopes ?? retained.grantedScopes,
          updatedAt: refreshedAt,
        },
        retained.tokenVersion,
        retained.updatedAt,
      );
    } catch {
      throw new SyncCalendarError("database", "retry_scheduled", true, 5);
    }
  }
  if (!retained.accessToken) {
    throw new SyncCalendarError("authorization", "disconnected", false);
  }
  return retained.accessToken;
}

/** Creates a canonical high-entropy base64url identifier. */
function randomOpaque(bytes: number): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Hashes a channel token before any lookup or persistence query. */
async function sha256Base64Url(value: string): Promise<string> {
  return encodeBase64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}

/** Derives the same stable private owner key used by authentication and Queue work. */
async function deriveOwnerId(googleSubject: string): Promise<string> {
  return `usr_${await sha256Base64Url(googleSubject)}`;
}

/** Admits the existing non-secret owner subject without copying it to errors. */
function readScheduledOwnerSubject(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 255 ||
    !/^[\x21-\x7e]+$/u.test(value)
  ) {
    throw new Error("Phase B AI usage candidate is unavailable.");
  }
  return value;
}
