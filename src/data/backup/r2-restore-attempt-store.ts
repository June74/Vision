/** Provides the temporary preview restore with one opaque atomic R2 fence. */
import { encodeBase64Url } from "../../crypto/envelope";

/** Namespace kept permanently disjoint from encrypted backup objects. */
export const RESTORE_ATTEMPT_PREFIX = "restore-attempts/v1/" as const;

/** Claim-only boundary; neither the marker key nor provider identity is returned. */
export interface RestoreAttemptStore {
  claimOnce(targetId: string): Promise<boolean>;
}

/** Adapts one private R2 bucket to an atomic create-if-absent restore claim. */
export function createR2RestoreAttemptStore(
  bucket: R2Bucket,
): RestoreAttemptStore {
  return {
    /** Grants ownership only to the invocation that creates the opaque marker. */
    async claimOnce(targetId: string): Promise<boolean> {
      try {
        if (
          typeof targetId !== "string" ||
          !/^[A-Za-z0-9_-]{1,128}$/u.test(targetId)
        ) {
          throw new Error("Restore attempt target is invalid.");
        }
        const digest = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              `vision-preview-restore-attempt\u0000${targetId}`,
            ),
          ),
        );
        const markerKey =
          `${RESTORE_ATTEMPT_PREFIX}${encodeBase64Url(digest)}`;
        const result = await bucket.put(markerKey, new Uint8Array(), {
          onlyIf: { etagDoesNotMatch: "*" },
        });
        return result !== null;
      } catch {
        throw new Error("Restore attempt claim failed.");
      }
    },
  };
}
