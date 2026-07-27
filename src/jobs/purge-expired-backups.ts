/** Purges only validated encrypted backup objects at the 30-day UTC-date boundary. */
import {
  BACKUP_OBJECT_PREFIX,
  type BackupObjectHead,
  type BackupObjectStore,
} from "./create-daily-backup";

/** Fixed recovery window measured in whole UTC calendar dates. */
export const BACKUP_RETENTION_DAYS = 30;

/** Privacy-safe retention evidence containing counts only. */
export interface PurgeResult {
  readonly purged: number;
  readonly ignoredMalformed: number;
}

/** Storage dependency for a complete paginated retention pass. */
export interface PurgeExpiredBackupsDependencies {
  readonly store: BackupObjectStore;
}

const DAY_MILLISECONDS = 86_400_000;
const OBJECT_KEY_PATTERN =
  /^backups\/v1\/(\d{4})\/(\d{2})\/(\d{2})\/[A-Za-z0-9_-]{43}\.vision-backup$/u;
const SHA256_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const METADATA_KEYS = [
  "ciphertextSha256",
  "createdDate",
  "format",
  "keyVersion",
] as const;

/** Deletes validated objects aged 30 whole UTC dates or more and retries safely. */
export async function purgeExpiredBackups(
  now: Date,
  dependencies: PurgeExpiredBackupsDependencies,
): Promise<PurgeResult> {
  const today = utcDateMilliseconds(now);
  let cursor: string | undefined;
  let purged = 0;
  let ignoredMalformed = 0;
  let deletionFailed = false;
  const seenCursors = new Set<string>();

  do {
    const page = await dependencies.store.list(BACKUP_OBJECT_PREFIX, cursor);
    for (const object of page.objects) {
      const createdDate = validatedBackupObjectDate(object);
      if (createdDate === undefined) {
        ignoredMalformed += 1;
        continue;
      }
      const ageDays = (today - createdDate) / DAY_MILLISECONDS;
      if (ageDays >= BACKUP_RETENTION_DAYS) {
        try {
          await dependencies.store.delete(object.key);
          purged += 1;
        } catch {
          deletionFailed = true;
        }
      }
    }
    cursor = page.cursor;
    if (cursor !== undefined) {
      if (cursor.length === 0 || seenCursors.has(cursor)) {
        throw new Error("Backup retention listing failed.");
      }
      seenCursors.add(cursor);
    }
  } while (cursor !== undefined);

  if (deletionFailed) {
    throw new Error("Backup retention deletion failed.");
  }
  return Object.freeze({ purged, ignoredMalformed });
}

/** Validates that object path, date, and closed safe metadata describe the same backup. */
export function validatedBackupObjectDate(
  object: BackupObjectHead,
): number | undefined {
  const match = OBJECT_KEY_PATTERN.exec(object.key);
  if (!match) return undefined;
  const createdDate = `${match[1]}-${match[2]}-${match[3]}`;
  const keys = Object.keys(object.customMetadata).sort();
  if (
    keys.length !== METADATA_KEYS.length ||
    keys.some((key, index) => key !== METADATA_KEYS[index]) ||
    object.customMetadata.format !== "vision-backup/v1" ||
    object.customMetadata.createdDate !== createdDate ||
    !SHA256_PATTERN.test(object.customMetadata.ciphertextSha256 ?? "") ||
    !/^[1-9]\d*$/u.test(object.customMetadata.keyVersion ?? "") ||
    !Number.isSafeInteger(Number(object.customMetadata.keyVersion)) ||
    !SHA256_PATTERN.test(object.bodySha256 ?? "")
  ) {
    return undefined;
  }
  return parseUtcDate(createdDate);
}

/** Converts the scheduler instant to its UTC-date midnight without local-time drift. */
function utcDateMilliseconds(now: Date): number {
  const time = Date.prototype.getTime.call(now);
  if (!Number.isFinite(time)) throw new Error("Backup retention time is invalid.");
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
}

/** Parses a canonical real four-digit UTC date or rejects normalization. */
function parseUtcDate(value: string): number | undefined {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = Date.UTC(year, month - 1, day);
  const date = new Date(parsed);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? parsed
    : undefined;
}
