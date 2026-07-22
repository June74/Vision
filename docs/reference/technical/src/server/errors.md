# `src/server/errors.ts`

This module centralizes the public API error contract. It transforms unknown exceptions at the request boundary, keeping exception details out of response serialization.

## `VisionError`

`VisionError` extends `Error` so Hono recognizes it as a thrown exception. Its intentional public contract is `code`, `status`, and `safeMessage`; the inherited error message is the same approved safe message and no cause or raw exception is retained.

## `ErrorEnvelope`

`ErrorEnvelope` is `{ error: { code, message, requestId } }`, the complete JSON error response contract.

## `toVisionError`

**Signature:** `toVisionError(error: unknown): VisionError`

Expected `VisionError` instances preserve their approved status and message. Every other thrown value becomes `INTERNAL_ERROR`, HTTP 500, and `An unexpected error occurred.` without using the original `message` or `stack`.

## `createErrorEnvelope`

**Signature:** `createErrorEnvelope(error: VisionError, requestId: string): ErrorEnvelope`

The function converts only the safe `VisionError` properties and the opaque request ID into the response body.
