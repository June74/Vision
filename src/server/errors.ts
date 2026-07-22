/** Defines public-safe API errors and creates request-correlated JSON error envelopes. */
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Represents an expected error whose public fields are safe to return to API callers. */
export class VisionError extends Error {
  /** Creates a safe error without retaining the original exception or request content. */
  constructor(
    public readonly code: string,
    public readonly status: ContentfulStatusCode,
    public readonly safeMessage: string,
  ) {
    super(safeMessage);
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

/** Narrows an unknown thrown value to a safe public error. */
export function toVisionError(error: unknown): VisionError {
  if (error instanceof VisionError) {
    return error;
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
