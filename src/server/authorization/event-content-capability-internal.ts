/** Internal object-identity registry shared only by authorization issuers and the production verifier. */
const verifiedAccesses = new WeakSet<object>();
const verifiedDecisions = new WeakSet<object>();

/** Registers one issuer-created access object by identity, not by copyable properties. */
export function registerVerifiedEventRepositoryAccess<T extends object>(access: T): T {
  verifiedAccesses.add(access);
  return access;
}

/** Reports whether the exact access object identity was registered by an allowed issuer. */
export function hasVerifiedEventRepositoryAccess(value: object): boolean {
  return verifiedAccesses.has(value);
}

/** Registers one issuer-created decision object by identity, not by copyable properties. */
export function registerEventContentAuthorizationDecision<T extends object>(decision: T): T {
  verifiedDecisions.add(decision);
  return decision;
}

/** Reports whether the exact decision object identity was registered by an allowed issuer. */
export function hasEventContentAuthorizationDecision(value: object): boolean {
  return verifiedDecisions.has(value);
}
