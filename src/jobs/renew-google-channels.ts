/** Renews Google Calendar notification channels without creating a verification race. */
import type { CalendarMaintenanceRenewalOutcome } from "./calendar-maintenance-evidence";

/** Exact active channel needed to stop only the superseded provider resource. */
export interface ActiveGoogleChannel {
  readonly rowId: string;
  readonly channelId: string;
  readonly resourceId: string;
  readonly expiresAt: Date;
}

/** One private connected calendar whose channel is missing, expired, or nearing expiry. */
export interface RenewalCandidate {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly connectionVersion: number;
  readonly checkpointVersion: number;
  readonly previous?: ActiveGoogleChannel;
}

/** Database lifecycle operations used by the renewal coordinator. */
export interface ChannelLifecycleRepository {
  listRenewalCandidates(now: Date): Promise<readonly RenewalCandidate[]>;
  preRegister(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    channelId: string;
    tokenHash: string;
    tokenEnvelope: Uint8Array;
    leaseId: string;
    expectedConnectionVersion: number;
    expectedCheckpointVersion: number;
    createdAt: Date;
  }): Promise<boolean | void>;
  bindWatchedResource(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    leaseId: string;
    resourceId: string;
  }): Promise<boolean>;
  activate(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    leaseId: string;
    expectedConnectionVersion: number;
    expectedCheckpointVersion: number;
    resourceId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  retire(rowId: string, now: Date): Promise<boolean>;
  recordFailure(input: {
    ownerId: string;
    calendarId: string;
    rowId: string;
    leaseId: string;
    expectedCheckpointVersion: number;
    resourceId?: string;
    providerStop: "not_attempted" | "succeeded" | "failed";
    now: Date;
  }): Promise<void>;
  listSupersededChannels?(): Promise<readonly ActiveGoogleChannel[]>;
  markCleanupRequired?(rowId: string, now: Date): Promise<void>;
}

/** Narrow provider channel surface; it intentionally contains no event operations. */
export interface GoogleChannelProvider {
  watch(input: {
    calendarId: string;
    channelId: string;
    channelToken: string;
  }): Promise<{ readonly resourceId: string; readonly expiresAt: Date }>;
  stop(input: { channelId: string; resourceId: string }): Promise<void>;
}

/** Injected secret-generation, encryption, persistence, and provider boundaries. */
export interface ChannelLifecycleDependencies {
  readonly repository: ChannelLifecycleRepository;
  readonly provider: GoogleChannelProvider;
  readonly createChannelId: () => string;
  readonly createChannelToken: () => string;
  readonly createLeaseId?: () => string;
  readonly hashToken: (token: string) => Promise<string>;
  readonly encryptToken: (
    token: string,
    context: { ownerId: string; rowId: string },
  ) => Promise<Uint8Array>;
}

/** Value-free terminal outcome for one renewal and deferred-cleanup selection pass. */
export type RenewExpiringChannelsOutcome = Exclude<
  CalendarMaintenanceRenewalOutcome,
  "failed"
>;

/** Renews every eligible channel while retaining the old valid channel until replacement activation. */
export async function renewExpiringChannels(
  now: Date,
  dependencies: ChannelLifecycleDependencies,
): Promise<RenewExpiringChannelsOutcome> {
  assertDate(now);
  const candidates = await dependencies.repository.listRenewalCandidates(now);
  let firstFailure: unknown;
  for (const candidate of candidates) {
    try {
      await renewOne(candidate, now, dependencies);
    } catch (error) {
      // One calendar cannot suppress the remaining owner-scoped maintenance work.
      firstFailure ??= error;
    }
  }
  const superseded =
    (await dependencies.repository.listSupersededChannels?.()) ?? [];
  for (const channel of superseded) {
    try {
      await dependencies.provider.stop({
        channelId: channel.channelId,
        resourceId: channel.resourceId,
      });
      await dependencies.repository.retire(channel.rowId, now);
    } catch {
      await dependencies.repository.markCleanupRequired?.(channel.rowId, now);
    }
  }
  if (firstFailure !== undefined) throw firstFailure;
  return candidates.length > 0 || superseded.length > 0
    ? "completed"
    : "no_work";
}

/** Executes one pre-register/watch/activate/stop/retire state machine. */
async function renewOne(
  candidate: RenewalCandidate,
  now: Date,
  dependencies: ChannelLifecycleDependencies,
): Promise<void> {
  const channelId = dependencies.createChannelId();
  const channelToken = dependencies.createChannelToken();
  const leaseId =
    dependencies.createLeaseId?.() ?? `lease_${crypto.randomUUID()}`;
  assertOpaqueSecret(channelId, 16, 256);
  assertOpaqueSecret(channelToken, 32, 256);
  const rowId = `channel_${channelId}`;
  const [tokenHash, tokenEnvelope] = await Promise.all([
    dependencies.hashToken(channelToken),
    dependencies.encryptToken(channelToken, {
      ownerId: candidate.ownerId,
      rowId,
    }),
  ]);
  const elected = await dependencies.repository.preRegister({
    rowId,
    ownerId: candidate.ownerId,
    calendarId: candidate.calendarId,
    channelId,
    tokenHash,
    tokenEnvelope,
    leaseId,
    expectedConnectionVersion: candidate.connectionVersion,
    expectedCheckpointVersion: candidate.checkpointVersion,
    createdAt: now,
  });
  if (elected === false) return;

  let watched:
    | { readonly resourceId: string; readonly expiresAt: Date }
    | undefined;
  try {
    watched = await dependencies.provider.watch({
      calendarId: candidate.calendarId,
      channelId,
      channelToken,
    });
    if (
      !watched.resourceId ||
      watched.resourceId.length > 1_024 ||
      watched.expiresAt.getTime() <= now.getTime()
    ) {
      throw new Error("Invalid Google watch response.");
    }
    const bound = await dependencies.repository.bindWatchedResource({
      rowId,
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      leaseId,
      resourceId: watched.resourceId,
    });
    if (!bound) throw new Error("Channel resource binding lost its lifecycle race.");
    const activated = await dependencies.repository.activate({
      rowId,
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      leaseId,
      expectedConnectionVersion: candidate.connectionVersion,
      expectedCheckpointVersion: candidate.checkpointVersion,
      resourceId: watched.resourceId,
      expiresAt: watched.expiresAt,
      now,
    });
    if (!activated) throw new Error("Channel activation lost its lifecycle race.");
  } catch {
    let providerStop: "not_attempted" | "succeeded" | "failed" =
      "not_attempted";
    if (watched) {
      try {
        await dependencies.provider.stop({
          channelId,
          resourceId: watched.resourceId,
        });
        providerStop = "succeeded";
      } catch {
        providerStop = "failed";
      }
    }
    await dependencies.repository.recordFailure({
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      rowId,
      leaseId,
      expectedCheckpointVersion: candidate.checkpointVersion,
      resourceId: watched?.resourceId,
      providerStop,
      now,
    });
    return;
  }

  if (!candidate.previous) return;
  try {
    await dependencies.provider.stop({
      channelId: candidate.previous.channelId,
      resourceId: candidate.previous.resourceId,
    });
    await dependencies.repository.retire(candidate.previous.rowId, now);
  } catch {
    // The replacement remains authoritative; a later repair can retry exact old-channel cleanup.
    await dependencies.repository.markCleanupRequired?.(
      candidate.previous.rowId,
      now,
    );
  }
}

/** Requires an intrinsic finite timestamp. */
function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Invalid channel maintenance timestamp.");
  }
}

/** Bounds provider-safe opaque values without copying them into errors. */
function assertOpaqueSecret(value: string, minimum: number, maximum: number): void {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    value.length > maximum ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new Error("Invalid opaque channel credential.");
  }
}
