# Server sessions

The browser cookie contains only a random bearer. Its SHA-256 hash is the database lookup key; identity and CSRF fields remain encrypted. Sessions expire after eight hours and can be revoked immediately.

## `requireSession`

Reads the server-populated Hono variable and throws a privacy-safe 401 when middleware or route resolution did not authenticate the request.

## `readSessionCookie`

Bounds the Cookie header, accepts exactly one `vision_session` pair, and enforces canonical base64url length.

## `createSessionCookie`

Serializes `Path=/`, `HttpOnly`, `SameSite=Lax`, bounded `Max-Age`, no Domain attribute, and `Secure` for preview and production.

## `clearSessionCookie`

Uses the same attributes with an empty value and `Max-Age=0`, preventing path-shadowed logout behavior.
