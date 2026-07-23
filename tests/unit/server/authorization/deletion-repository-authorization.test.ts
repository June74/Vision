import { describe, expect, it } from "vitest";
import {
  DeletionOwnerAccessDeniedError,
  createDeletionPurgeRepository,
  createDeletionRepository,
} from "../../../../src/data/repositories/deletion-repository";
import type { VisionDatabase } from "../../../../src/data/db";
import {
  isVerifiedDeletionPurgeAccess,
  isVerifiedDeletionRepositoryAccess,
  type VerifiedDeletionRepositoryAccess,
} from "../../../../src/server/authorization/deletion-repository-authorization";
import {
  createTestDeletionPurgeAccess,
  createTestDeletionRepositoryAccess,
} from "../../../../src/server/authorization/test-deletion-repository-authorization";

describe("deletion repository access capabilities", () => {
  it("accepts only non-forgeable owner and system authority capabilities", () => {
    const ownerAccess = createTestDeletionRepositoryAccess("owner_1");
    const systemAccess = createTestDeletionPurgeAccess();

    expect(isVerifiedDeletionRepositoryAccess(ownerAccess)).toBe(true);
    expect(isVerifiedDeletionPurgeAccess(systemAccess)).toBe(true);
    expect(() => createDeletionRepository({} as VisionDatabase, {
      authenticatedOwnerId: "owner_1",
    } as VerifiedDeletionRepositoryAccess)).toThrow(DeletionOwnerAccessDeniedError);
    expect(() => createDeletionPurgeRepository({} as VisionDatabase, {} as never)).toThrow(DeletionOwnerAccessDeniedError);
  });

  it("does not transfer authority when every discoverable property is copied", () => {
    const access = createTestDeletionRepositoryAccess("owner_1");
    const copied = Object.defineProperties({}, Object.getOwnPropertyDescriptors(access));

    expect(isVerifiedDeletionRepositoryAccess(copied)).toBe(false);
  });
});
