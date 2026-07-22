import { describe, expect, it } from "vitest";
import { toVisionError, toVisionErrorResponse, VisionError } from "../../../src/server/errors";

describe("VisionError", () => {
  it("exposes only its approved public fields", () => {
    const error = new VisionError("NOT_FOUND", 404, "API route not found.");

    expect(Reflect.ownKeys(error)).toEqual(["code", "status", "safeMessage"]);
  });
});

describe("toVisionErrorResponse", () => {
  it("preserves an expected VisionError in an exact envelope", () => {
    const response = toVisionErrorResponse(new VisionError("NOT_FOUND", 404, "API route not found."), "req_test");

    expect(response).toEqual({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "API route not found.",
          requestId: "req_test",
        },
      },
    });
  });

  it("maps an unknown Error without exposing its message", () => {
    const response = toVisionErrorResponse(new Error("private provider failure"), "req_test");

    expect(toVisionError(new Error("private provider failure")).code).toBe("INTERNAL_ERROR");
    expect(response).toEqual({
      status: 500,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
          requestId: "req_test",
        },
      },
    });
  });
});
