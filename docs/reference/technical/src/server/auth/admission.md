# OAuth admission keys

## Signatures

```ts
type AuthAdmissionKeyFactory = (
  request: Request,
  authenticatedOwnerId?: string,
) => Promise<string>;
createAuthAdmissionKeyFactory(
  rootKeyBase64Url: string,
  environment: "local" | "preview" | "production",
): Promise<AuthAdmissionKeyFactory>;
```

## Dependencies

Uses Web Crypto HKDF-SHA-256 to derive a purpose-specific HMAC-SHA-256 key plus the shared canonical base64url decoder. The caller supplies the validated 256-bit Worker root key and runtime environment.

## Inputs and outputs

The factory accepts an HTTP request and an optional owner ID that was already resolved from a valid server session. It returns a 43-character keyed digest; the source owner or address is not recoverable from the output.

## Side effects

Factory creation imports the root bytes for HKDF, derives a non-extractable HMAC key with fixed salt/info, and clears the mutable decoded root-key copy. Each call signs one domain-separated in-memory source string. It performs no database, network, log, or cookie operation.

## Failure behavior

Malformed root key material rejects factory creation. Missing, malformed, accessor-backed, or local Cloudflare metadata falls back to one shared untrusted bucket rather than trusting a header.

## Privacy and authorization

A verified session owner takes precedence. Otherwise, `CF-Connecting-IP` is used only outside local when a bounded own `cf.colo` metadata property is present. `X-Forwarded-For` is never read. Neither source nor root key is logged, persisted, or returned.

## Covering tests

`tests/unit/server/auth/admission.test.ts` covers spoofed headers, local fallback, trusted Cloudflare separation, verified-session binding, canonical output, and plaintext absence.

## `createAuthAdmissionKeyFactory`

Derives non-extractable HMAC-SHA-256 material from validated root bytes through purpose-specific HKDF parameters and returns the request-bound function.

## `readTrustedCloudflareClient`

Snapshots trusted platform metadata and returns a bounded lowercase address source only when all trust checks pass.
