# Server sessions

The browser cookie contains only a random bearer. Its SHA-256 hash is the database lookup key; identity and CSRF fields remain encrypted. Sessions expire after eight hours and can be revoked immediately.

## Signatures

```ts
requireSession(
  context: Pick<Context<{ Variables: AuthRequestVariables }>, "get">,
): AuthenticatedSession;
readSessionCookie(request: Request): string | undefined;
createSessionCookie(sessionId: string, environment: VisionEnvironment, maxAgeSeconds: number): string;
clearSessionCookie(environment: VisionEnvironment): string;
```

## Dependencies

Uses Hono context variables and Vision's safe `VisionError` boundary. Cookie parsing/serialization uses only platform Request headers and fixed policy constants.

## Inputs and outputs

Inputs are a server-populated context, a bounded Cookie header, an opaque session bearer, environment, and lifetime. Outputs are a trusted server session or serialized host-only cookie value.

## Side effects

These helpers do not read or write the database. Cookie creators return header strings; the route decides when to attach them.

## Failure behavior

Missing session context throws a fixed 401. Duplicate/malformed/oversized cookies return `undefined`. Invalid bearer/lifetime inputs throw constant local errors without reflecting the bearer.

## Privacy and authorization

Cookie values contain only random opaque IDs, never owner, email, CSRF, Google subject, or provider tokens. `requireSession` trusts only a session that the server repository already resolved.

## Covering tests

`tests/worker/auth.test.ts` covers duplicate/missing sessions, preview/local flags, rotation, bounded lifetime, logout clearing, and CSRF-bound server state.

## `requireSession`

Reads the server-populated Hono variable and throws a privacy-safe 401 when middleware or route resolution did not authenticate the request.

## `readSessionCookie`

Bounds the Cookie header, accepts exactly one `vision_session` pair, and enforces canonical base64url length.

## `createSessionCookie`

Serializes `Path=/`, `HttpOnly`, `SameSite=Lax`, bounded `Max-Age`, no Domain attribute, and `Secure` for preview and production.

## `clearSessionCookie`

Uses the same attributes with an empty value and `Max-Age=0`, preventing path-shadowed logout behavior.
