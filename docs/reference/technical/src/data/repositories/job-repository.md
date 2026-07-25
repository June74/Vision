# `src/data/repositories/job-repository.ts`

The job repository is the PostgreSQL authority between an unauthenticated Google signal and an at-least-once Cloudflare Queue delivery. All SQL is parameterized, all messages are content-free, and every consumer transition is guarded by an exact claim lease.

## `findGoogleChannel`

Queries `sync_channels` with provider, channel ID, and the SHA-256 token digest, then joins the authoritative checkpoint and requires `connected`. It returns only owner, calendar, resource identity, digest, and expiry; the encrypted recovery token never crosses this boundary.

## `reserveWebhookJob`

Inserts `pending_enqueue` with a stable job ID. A conflict is accepted only when owner, calendar, provider, and reason exactly match. A still-pending winner can be sent again after an uncertain Queue call.

## `markEnqueued`

Moves only `pending_enqueue` to `enqueued`, so a consumer claim cannot be overwritten by a late producer update.

## `claimJob`

First reconciles a `sync_runs` winner left by a crash after sync commit. Otherwise it atomically claims a matching nonterminal job. A larger Cloudflare delivery attempt may reclaim a crashed `in_progress` lease; same-attempt duplicates cannot.

## `completeJob`

Requires the exact active claim and stores checkpoint, page, and change counts without provider content.

## `scheduleRetry`

Moves the exact active lease to `retry_scheduled`, retaining only an allowlisted error category.

## `failJob`

Moves the exact active lease to terminal `failed`; retry exhaustion may set `action_required`.

## `finishClaimedFailure`

Locks the exact in-progress claim, updates safe checkpoint health only at the generation captured when that claim began, and finishes the job in the same PostgreSQL statement. A stolen lease makes both updates no-ops.

## `finishFailure`

Centralizes the parameterized claim CAS used by retry and terminal failure updates.

## `createCalendarJobRepository`

Constructs the repository over the typed Vision database.

## `decodeChannel`

Strictly decodes the safe channel projection and rejects malformed digests or timestamps.

## `decodeMessage`

Reconstructs only `jobId`, `ownerId`, `calendarId`, and the closed reason enum.

## `readText`

Prevents malformed database text from entering a message or identity comparison.

## `readHash`

Enforces the 43-character unpadded SHA-256 base64url shape.

## `readPositiveInteger`

Accepts only safe positive integers or canonical decimal strings.

## `readNonNegativeInteger`

Accepts safe non-negative integers for checkpoint generations captured with a job claim.

## `readDate`

Accepts a real `Date` or a timestamp string carrying an explicit offset.

## `assertAttempt`

Rejects non-integer, nonpositive, and implausibly large delivery attempts.

## `assertClaimId`

Rejects empty or oversized lease IDs.

## `assertDate`

Uses the trusted `Date` intrinsic to reject invalid times.
