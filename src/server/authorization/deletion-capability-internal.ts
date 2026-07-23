/** Keeps deletion authority registrations private to verified server composition and Vitest-only issuers. */

const ownerAccesses = new WeakSet<object>();
const purgeAccesses = new WeakSet<object>();

/** Registers an owner-scoped capability that cannot be recreated by copying its public properties. */
export function registerVerifiedDeletionRepositoryAccess(access: object): void {
  ownerAccesses.add(access);
}

/** Registers a system-only purge capability that cannot be supplied by an ordinary user request. */
export function registerVerifiedDeletionPurgeAccess(access: object): void {
  purgeAccesses.add(access);
}

/** Returns whether an object was issued by the owner-scoped deletion authority boundary. */
export function hasVerifiedDeletionRepositoryAccess(access: object): boolean {
  return ownerAccesses.has(access);
}

/** Returns whether an object was issued by the global scheduled-purge authority boundary. */
export function hasVerifiedDeletionPurgeAccess(access: object): boolean {
  return purgeAccesses.has(access);
}
