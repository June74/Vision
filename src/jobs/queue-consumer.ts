/** Claims opaque calendar queue jobs and maps safe sync outcomes to ack or bounded retry. */
import { createDb } from "../data/db";
import {
  createCalendarJobRepository,
  type CalendarJobRepository,
} from "../data/repositories/job-repository";
import { createProjectionRepository } from "../data/repositories/projection-repository";
import { createSyncRepository } from "../data/repositories/sync-repository";
import {
  DrizzleTokenStore,
  DrizzleWrappedDataKeyStore,
  EncryptedTokenRepository,
} from "../data/repositories/token-repository";
import { createWrappedKeyProvider } from "../crypto/key-provider";
import { createGoogleEventSyncClient } from "../integrations/google-calendar/event-sync-client";
import {
  GoogleOAuthClient,
  GoogleOAuthError,
} from "../integrations/google/oauth-client";
import { parseGoogleAuthEnvironment, parseVisionKeyEncryptionKey, type Env } from "../server/env";
import {
  SyncCalendarError,
  syncCalendar,
  type SyncCalendarRequest,
  type SyncResult,
} from "./sync-calendar";
import {
  parseCalendarSyncMessage,
  type CalendarSyncMessage,
} from "./queue-message";

const MAX_DELIVERY_ATTEMPTS = 6;

/** Narrow Queue delivery used by the consumer and deterministic integration tests. */
export interface CalendarSyncQueueMessage {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: unknown;
  readonly attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

/** Narrow Queue batch that contains no provider content. */
export interface CalendarSyncBatch {
  readonly queue: string;
  readonly messages: readonly CalendarSyncQueueMessage[];
}

/** Injected boundaries for deterministic claim, retry, and duplicate tests. */
export interface CalendarSyncConsumerDependencies {
  readonly repository: CalendarJobRepository;
  readonly sync: (
    request: SyncCalendarRequest,
    queueLease: { readonly claimId: string },
  ) => Promise<SyncResult>;
  readonly now?: () => Date;
  readonly createClaimId?: () => string;
}

/** Consumes each delivery serially so one personal calendar cannot race itself in one batch. */
export async function consumeCalendarSyncBatch(
  batch: CalendarSyncBatch,
  dependencies: CalendarSyncConsumerDependencies,
): Promise<void> {
  for (const delivery of batch.messages) {
    await consumeOne(delivery, dependencies);
  }
}

/** Cloudflare Queue entry point using production database, token, and Google read boundaries. */
export async function consumer(
  batch: MessageBatch<CalendarSyncMessage>,
  environment: Env,
  _context: ExecutionContext,
): Promise<void> {
  const dependencies = await createProductionCalendarSyncConsumerDependencies(
    environment,
  );
  await consumeCalendarSyncBatch(batch, dependencies);
}

/** Handles one delivery only after a durable claim and records disposition before ack or retry. */
async function consumeOne(
  delivery: CalendarSyncQueueMessage,
  dependencies: CalendarSyncConsumerDependencies,
): Promise<void> {
  let message: CalendarSyncMessage;
  try {
    message = parseCalendarSyncMessage(delivery.body);
  } catch {
    delivery.ack();
    return;
  }
  const now = dependencies.now ?? (() => new Date());
  const createClaimId = dependencies.createClaimId ?? (() => crypto.randomUUID());
  let claim;
  try {
    claim = await dependencies.repository.claimJob(
      message,
      delivery.attempts,
      createClaimId(),
      now(),
    );
  } catch {
    delivery.retry({ delaySeconds: retryDelay(delivery.attempts) });
    return;
  }
  if (claim.outcome !== "claimed") {
    delivery.ack();
    return;
  }

  const request: SyncCalendarRequest = {
    ...claim.job.message,
    deliveryAttempt: claim.job.attempt,
    expectedCheckpointVersion: claim.job.checkpointVersion,
  };
  try {
    const result = await dependencies.sync(request, {
      claimId: claim.job.claimId,
    });
    const completed = await dependencies.repository.completeJob(
      message.jobId,
      claim.job.claimId,
      result,
      now(),
    );
    if (completed) delivery.ack();
    else delivery.retry({ delaySeconds: retryDelay(claim.job.attempt) });
  } catch (error) {
    if (error instanceof SyncCalendarError) {
      const exhausted =
        error.retry && claim.job.attempt >= MAX_DELIVERY_ATTEMPTS;
      const classified = exhausted
        ? new SyncCalendarError(error.category, "action_required", false)
        : error;
      if (classified.retry) {
        const scheduled =
          await dependencies.repository.finishClaimedFailure({
            jobId: message.jobId,
            claimId: claim.job.claimId,
            expectedCheckpointVersion: claim.job.checkpointVersion,
            status: "retry_scheduled",
            category: classified.category,
            state: classified.state,
            now: now(),
          });
        if (scheduled) {
          delivery.retry({
            delaySeconds:
              classified.retryDelaySeconds ?? retryDelay(claim.job.attempt),
          });
        } else {
          delivery.ack();
        }
        return;
      }
      await dependencies.repository.finishClaimedFailure({
        jobId: message.jobId,
        claimId: claim.job.claimId,
        expectedCheckpointVersion: claim.job.checkpointVersion,
        status: "failed",
        category: classified.category,
        state: classified.state,
        now: now(),
      });
      delivery.ack();
      return;
    }

    if (claim.job.attempt >= MAX_DELIVERY_ATTEMPTS) {
      await dependencies.repository.finishClaimedFailure({
        jobId: message.jobId,
        claimId: claim.job.claimId,
        expectedCheckpointVersion: claim.job.checkpointVersion,
        status: "failed",
        category: "transient",
        state: "action_required",
        now: now(),
      });
      delivery.ack();
      return;
    }
    const scheduled =
      await dependencies.repository.finishClaimedFailure({
        jobId: message.jobId,
        claimId: claim.job.claimId,
        expectedCheckpointVersion: claim.job.checkpointVersion,
        status: "retry_scheduled",
        category: "transient",
        state: "retry_scheduled",
        now: now(),
      });
    if (scheduled) {
      delivery.retry({ delaySeconds: retryDelay(claim.job.attempt) });
    } else {
      delivery.ack();
    }
  }
}

/** Creates production queue dependencies without placing provider tokens in a message or log. */
async function createProductionCalendarSyncConsumerDependencies(
  environment: Env,
): Promise<CalendarSyncConsumerDependencies> {
  const authEnvironment = parseGoogleAuthEnvironment(environment);
  const database = createDb(environment.DATABASE_URL);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  const ownerId = await deriveOwnerId(authEnvironment.GOOGLE_ALLOWED_SUB);
  const tokenRepository = new EncryptedTokenRepository(
    new DrizzleTokenStore(database),
    keyProvider,
    ownerId,
  );
  const oauthClient = new GoogleOAuthClient(
    {
      clientId: authEnvironment.GOOGLE_CLIENT_ID,
      clientSecret: authEnvironment.GOOGLE_CLIENT_SECRET,
      redirectUri: authEnvironment.GOOGLE_REDIRECT_URI,
    },
    fetch.bind(globalThis),
    {
      /** This refresh-only client never accepts or verifies an ID token. */
      async verify() {
        throw new Error("ID-token verification is unavailable.");
      },
    },
  );
  const syncRepository = createSyncRepository(database, keyProvider, ownerId);
  const projectionRepository = createProjectionRepository(
    database,
    keyProvider,
    ownerId,
  );
  return {
    repository: createCalendarJobRepository(database),
    /** Reads a fresh timestamp for each durable queue transition. */
    now: () => new Date(),
    /** Creates a unique opaque lease for one atomic job claim. */
    createClaimId: () => crypto.randomUUID(),
    /** Resolves owner-bound tokens and runs the existing transactional sync job. */
    sync: async (request, queueLease) => {
      if (request.ownerId !== ownerId) {
        throw new SyncCalendarError("authorization", "disconnected", false);
      }
      let tokens = await tokenRepository.getGoogleTokens(
        authEnvironment.GOOGLE_ALLOWED_SUB,
      );
      if (!tokens) {
        throw new SyncCalendarError("authorization", "disconnected", false);
      }
      if (
        !tokens.accessToken ||
        tokens.accessExpiresAt.getTime() <= Date.now() + 60_000
      ) {
        let refreshed;
        try {
          refreshed = await oauthClient.refreshAccessToken(tokens.refreshToken);
        } catch (error) {
          throw classifyGoogleRefreshError(error);
        }
        const refreshedAt = new Date();
        try {
          tokens = await tokenRepository.saveRefreshedAccessToken(
            {
              googleSubject: authEnvironment.GOOGLE_ALLOWED_SUB,
              accessToken: refreshed.accessToken,
              accessExpiresAt: new Date(
                refreshedAt.getTime() + refreshed.expiresInSeconds * 1_000,
              ),
              grantedScopes: refreshed.scopes ?? tokens.grantedScopes,
              updatedAt: refreshedAt,
            },
            tokens.tokenVersion,
            tokens.updatedAt,
          );
        } catch {
          throw new SyncCalendarError("database", "retry_scheduled", true, 5);
        }
      }
      if (!tokens.accessToken) {
        throw new SyncCalendarError("authorization", "disconnected", false);
      }
      return syncCalendar(request, {
        client: createGoogleEventSyncClient({
          accessToken: tokens.accessToken,
          fetcher: fetch.bind(globalThis),
        }),
        repository: syncRepository,
        projectionRepository,
        queueLease,
        persistFailure: false,
      });
    },
  };
}

/** Maps the OAuth adapter's safe refresh categories to truthful synchronization disposition. */
export function classifyGoogleRefreshError(error: unknown): SyncCalendarError {
  if (error instanceof GoogleOAuthError) {
    if (error.category === "transient") {
      return new SyncCalendarError("transient", "retry_scheduled", true, 5);
    }
    if (error.category === "authorization") {
      return new SyncCalendarError("authorization", "disconnected", false);
    }
  }
  return new SyncCalendarError("provider", "action_required", false);
}

/** Derives the same stable opaque owner key used at the OAuth admission boundary. */
async function deriveOwnerId(googleSubject: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(googleSubject),
    ),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `usr_${btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "")}`;
}

/** Computes a bounded fallback queue delay without retrying inside one Worker invocation. */
function retryDelay(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt <= 0) return 5;
  return Math.min(600, 5 * 2 ** Math.min(7, attempt - 1));
}
