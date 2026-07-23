# Server sessions

Defines the opaque session cookie and the authenticated context returned after a server-side lookup.

## `requireSession`

Returns the resolved session or a constant authentication-required error.

## `readSessionCookie`

Reads one valid session cookie and rejects duplicates.

## `createSessionCookie`

Creates a host-only, HttpOnly, SameSite Lax cookie that is Secure outside local development.

## `clearSessionCookie`

Expires the cookie with the same path and security attributes.
