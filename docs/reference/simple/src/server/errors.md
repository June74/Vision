# `src/server/errors.ts`

This module turns safe application errors into a consistent JSON response. It never puts an original error message or stack trace in the response.

## `VisionError`

`VisionError` holds a public error code, HTTP status, and safe message for errors the app expects.

## `ErrorEnvelope`

`ErrorEnvelope` is the JSON response shape: an error code, message, and request ID.

## `toVisionError`

`toVisionError` keeps expected errors and replaces unexpected failures with a general internal-error response.

## `createErrorEnvelope`

`createErrorEnvelope` builds the safe JSON body returned to an API caller.
