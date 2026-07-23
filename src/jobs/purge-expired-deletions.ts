/** Coordinates the scheduled permanent-purge job through the authoritative deletion repository. */
import type {
  DeletionPurgeRepository,
  PurgeExpiredDeletionsResult,
} from "../data/repositories/deletion-repository";

/** Background-job surface used by a scheduler after it supplies one authoritative UTC instant. */
export interface PurgeExpiredDeletionsJob {
  purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult>;
}

/** Wires the retryable scheduled job without giving job code direct access to protected database rows. */
export function createPurgeExpiredDeletionsJob(
  repository: DeletionPurgeRepository,
): PurgeExpiredDeletionsJob {
  return {
    /** Delegates one idempotent permanent-purge pass to the transaction-owning repository. */
    async purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult> {
      return repository.purgeExpiredDeletions(now);
    },
  };
}
