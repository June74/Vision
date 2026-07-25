/** Coordinates periodic channel renewal and missed-notification repair. */
import { createDb } from "../data/db";
import { createChannelMaintenanceRepository } from "../data/repositories/channel-maintenance-repository";
import {
  DrizzleTokenStore,
  DrizzleWrappedDataKeyStore,
  EncryptedTokenRepository,
} from "../data/repositories/token-repository";
import { encodeBase64Url, serializeCipherEnvelope } from "../crypto/envelope";
import { createWrappedKeyProvider } from "../crypto/key-provider";
import { encryptProtectedFields } from "../crypto/protected-fields";
import { CalendarClient } from "../integrations/google-calendar/calendar-client";
import {
  GoogleOAuthClient,
  GoogleOAuthError,
} from "../integrations/google/oauth-client";
import {
  parseGoogleAuthEnvironment,
  parseVisionKeyEncryptionKey,
  type Env,
} from "../server/env";
import { renewExpiringChannels } from "./renew-google-channels";
import { repairCalendarSync } from "./repair-calendar-sync";

/** Injected maintenance functions keep the scheduler free of event-fetching capability. */
export interface ScheduledCalendarMaintenanceDependencies {
  readonly renew: (now: Date) => Promise<void>;
  readonly repair: (now: Date) => Promise<void>;
}

/** Runs channel maintenance before reserving ordinary repair work. */
export async function runScheduledCalendarMaintenance(
  now: Date,
  dependencies: ScheduledCalendarMaintenanceDependencies,
): Promise<void> {
  await dependencies.renew(now);
  await dependencies.repair(now);
}

/** Cloudflare scheduled entry point; it reserves Queue work and never reads event content. */
export async function scheduled(
  controller: ScheduledController,
  environment: Env,
  _context: ExecutionContext,
): Promise<void> {
  const dependencies =
    await createProductionScheduledCalendarMaintenanceDependencies(environment);
  await runScheduledCalendarMaintenance(new Date(controller.scheduledTime), dependencies);
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
  const tokens = new EncryptedTokenRepository(
    new DrizzleTokenStore(database),
    keyProvider,
    ownerId,
  );
  let retained = await tokens.getGoogleTokens(auth.GOOGLE_ALLOWED_SUB);
  if (!retained) throw new Error("Calendar authorization is unavailable.");
  if (
    !retained.accessToken ||
    retained.accessExpiresAt.getTime() <= Date.now() + 60_000
  ) {
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
    try {
      const refreshed = await oauth.refreshAccessToken(retained.refreshToken);
      const refreshedAt = new Date();
      retained = await tokens.saveRefreshedAccessToken(
        {
          googleSubject: auth.GOOGLE_ALLOWED_SUB,
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
    } catch (error) {
      if (error instanceof GoogleOAuthError) {
        throw new Error("Calendar authorization refresh failed.");
      }
      throw new Error("Calendar authorization persistence failed.");
    }
  }
  if (!retained.accessToken) {
    throw new Error("Calendar authorization is unavailable.");
  }
  const client = new CalendarClient(
    retained.accessToken,
    auth.GOOGLE_ALLOWED_SUB,
    fetch.bind(globalThis),
  );
  const repository = createChannelMaintenanceRepository(database, ownerId);
  const callbackUri = new URL("/webhooks/google/calendar", auth.GOOGLE_REDIRECT_URI)
    .toString();
  return {
    /** Renews eligible provider channels using the lifecycle repository. */
    renew: (now) =>
      renewExpiringChannels(now, {
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
      }),
    /** Reserves stale-calendar repair through the normal opaque Queue. */
    repair: (now) =>
      repairCalendarSync(now, {
        repository,
        queue: environment.CALENDAR_SYNC_QUEUE!,
      }),
  };
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
