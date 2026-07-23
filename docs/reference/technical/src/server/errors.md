# `src/server/errors.ts`

This module centralizes the public API error contract. It transforms unknown exceptions at the request boundary, keeping exception details out of response serialization.

## `VisionError`

`VisionError` is a plain class with exactly three own runtime keys: `code`, `status`, and `safeMessage`. It does not extend `Error`, so it does not expose a framework message, name, or stack.

## `ErrorEnvelope`

`ErrorEnvelope` is `{ error: { code, message, requestId } }`, the complete JSON error response contract.

## `VisionErrorResponse`

`VisionErrorResponse` is `{ status, body }`, where `body` is an `ErrorEnvelope` and `status` is a Hono content-bearing status code.

## `throwVisionError`

**Signature:** `throwVisionError(error: VisionError): never`

Hono only sends `Error` instances to its error handler. This function uses a private `Error` carrier to transport the plain `VisionError`, preserving the exact public runtime contract while allowing route code to throw an expected safe error.

## `toVisionError`

**Signature:** `toVisionError(error: unknown): VisionError`

Expected `VisionError` instances preserve their approved status and message. Every other thrown value becomes `INTERNAL_ERROR`, HTTP 500, and `An unexpected error occurred.` without using the original `message` or `stack`.

## `createErrorEnvelope`

**Signature:** `createErrorEnvelope(error: VisionError, requestId: string): ErrorEnvelope`

The function converts only the safe `VisionError` properties and the opaque request ID into the response body.

## `toVisionErrorResponse`

**Signature:** `toVisionErrorResponse(error: unknown, requestId: string): VisionErrorResponse`

The function first calls `toVisionError`, then returns the resolved status and envelope. Unknown exceptions become `INTERNAL_ERROR` without reading their messages or stacks.
