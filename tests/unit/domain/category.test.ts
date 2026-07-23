import { describe, expect, it } from "vitest";
import { resolveDomain } from "../../../src/domain/categorization/category";

describe("resolveDomain", () => {
  it("prefers an explicit category over source and AI", () => {
    expect(
      resolveDomain({
        explicit: "personal",
        confirmedSource: "work",
        inference: { domain: "school", confidence: 0.99 },
      }),
    ).toEqual({ domain: "personal", state: "confirmed", basis: "explicit" });
  });

  it("uses a confirmed source when no explicit category exists", () => {
    expect(
      resolveDomain({
        confirmedSource: "work",
        inference: { domain: "school", confidence: 0.99 },
      }),
    ).toEqual({ domain: "work", state: "confirmed", basis: "confirmed_source" });
  });

  it("retains inference confidence only when inference resolves the category", () => {
    expect(resolveDomain({ inference: { domain: "school", confidence: 0.99 } })).toEqual({
      domain: "school",
      state: "inferred",
      basis: "inference",
      confidence: 0.99,
    });
  });

  it("keeps an ambiguous item unresolved", () => {
    expect(resolveDomain({ inference: undefined })).toEqual({
      domain: "unresolved",
      state: "unresolved",
      basis: "none",
    });
  });
});
