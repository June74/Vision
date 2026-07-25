/** Renews Google Calendar notification channels without creating a verification race. */

const ACTION_REQUIRED_FAILURES = 6;

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
  readonly previous?: ActiveGoogleChannel;
  readonly consecutiveFailures: number;
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
    createdAt: Date;
  }): Promise<void>;
  activate(input: {
    rowId: string;
    resourceId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  retire(rowId: string, now: Date): Promise<boolean>;
  recordFailure(input: {
    ownerId: string;
    calendarId: string;
    rowId: string;
    actionRequired: boolean;
    now: Date;
  }): Promise<void>;
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
  readonly hashToken: (token: string) => Promise<string>;
  readonly encryptToken: (
    token: string,
    context: { ownerId: string; rowId: string },
  ) => Promise<Uint8Array>;
}

/** Renews every eligible channel while retaining the old valid channel until replacement activation. */
export async function renewExpiringChannels(
  now: Date,
  dependencies: ChannelLifecycleDependencies,
): Promise<void> {
  assertDate(now);
  const candidates = await dependencies.repository.listRenewalCandidates(now);
  for (const candidate of candidates) {
    await renewOne(candidate, now, dependencies);
  }
}

/** Executes one pre-register/watch/activate/stop/retire state machine. */
async function renewOne(
  candidate: RenewalCandidate,
  now: Date,
  dependencies: ChannelLifecycleDependencies,
): Promise<void> {
  const channelId = dependencies.createChannelId();
  const channelToken = dependencies.createChannelToken();
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
  await dependencies.repository.preRegister({
    rowId,
    ownerId: candidate.ownerId,
    calendarId: candidate.calendarId,
    channelId,
    tokenHash,
    tokenEnvelope,
    createdAt: now,
  });

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
    const activated = await dependencies.repository.activate({
      rowId,
      resourceId: watched.resourceId,
      expiresAt: watched.expiresAt,
      now,
    });
    if (!activated) throw new Error("Channel activation lost its lifecycle race.");
  } catch {
    if (watched) {
      try {
        await dependencies.provider.stop({
          channelId,
          resourceId: watched.resourceId,
        });
      } catch {
        // The provider cleanup is best effort; durable failure state drives later repair.
      }
    }
    await dependencies.repository.recordFailure({
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      rowId,
      actionRequired:
        candidate.consecutiveFailures + 1 >= ACTION_REQUIRED_FAILURES ||
        (candidate.previous?.expiresAt.getTime() ?? 0) <= now.getTime(),
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
    await dependencies.repository.recordFailure({
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      rowId: candidate.previous.rowId,
      actionRequired: false,
      now,
    });
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
