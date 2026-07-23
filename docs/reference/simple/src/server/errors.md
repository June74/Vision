# `src/server/errors.ts`

This module turns safe application errors into a consistent JSON response. It never puts an original error message or stack trace in the response.

## `VisionError`

`VisionError` holds only a public error code, HTTP status, and safe message for errors the app expects.

## `ErrorEnvelope`

`ErrorEnvelope` is the JSON response shape: an error code, message, and request ID.

## `VisionErrorResponse`

`VisionErrorResponse` pairs a safe error body with its HTTP status.

## `throwVisionError`

`throwVisionError` lets the Worker send an expected safe error through its framework handler without adding framework error details to `VisionError` itself.

## `toVisionError`

`toVisionError` keeps expected errors and replaces unexpected failures with a general internal-error response.

## `createErrorEnvelope`

`createErrorEnvelope` builds the safe JSON body returned to an API caller.

## `toVisionErrorResponse`

`toVisionErrorResponse` maps an expected or unexpected thrown value to a complete safe response.
