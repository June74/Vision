# Sign-in admission

Vision limits how many Google sign-in attempts one client can keep open. It converts a verified session owner or Cloudflare-provided client address into a keyed, unreadable identifier. Local and untrusted forwarding headers share a conservative fallback bucket, so callers cannot evade the limit by inventing proxy headers.

## `createAuthAdmissionKeyFactory`

Creates the server-only function that turns trusted request context into an opaque admission key. It never returns or stores the original owner or network address.

## `readTrustedCloudflareClient`

Uses Cloudflare's connecting address only when Cloudflare request metadata is also present and the app is not running locally.
