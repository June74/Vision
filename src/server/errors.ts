/** Defines public-safe API errors and creates request-correlated JSON error envelopes. */
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Represents an expected error whose public fields are safe to return to API callers. */
export class VisionError {
  /** Creates a safe error without retaining the original exception or request content. */
  constructor(
    public readonly code: string,
    public readonly status: ContentfulStatusCode,
    public readonly safeMessage: string,
  ) {}
}

/** Carries a safe error through Hono's Error-only handler without changing VisionError's public shape. */
class VisionErrorThrowable extends Error {
  /** Wraps a safe error for framework-level exception handling. */
  constructor(readonly visionError: VisionError) {
    super(visionError.safeMessage);
  }
}

/** Describes the public JSON shape returned for every API error. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

/** Pairs a safe error envelope with the HTTP status required to send it. */
export interface VisionErrorResponse {
  status: ContentfulStatusCode;
  body: ErrorEnvelope;
}

/** Throws an expected Vision error through Hono without exposing framework-only Error fields to callers. */
export function throwVisionError(error: VisionError): never {
  throw new VisionErrorThrowable(error);
}

/** Narrows an unknown thrown value to a safe public error. */
export function toVisionError(error: unknown): VisionError {
  if (error instanceof VisionError) {
    return error;
  }

  if (error instanceof VisionErrorThrowable) {
    return error.visionError;
  }

  return new VisionError("INTERNAL_ERROR", 500, "An unexpected error occurred.");
}

/** Produces an error body that callers can correlate without exposing implementation details. */
export function createErrorEnvelope(error: VisionError, requestId: string): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.safeMessage,
      requestId,
    },
  };
}

/** Maps any thrown value to a complete public-safe error response. */
export function toVisionErrorResponse(error: unknown, requestId: string): VisionErrorResponse {
  const visionError = toVisionError(error);
  return { status: visionError.status, body: createErrorEnvelope(visionError, requestId) };
}
