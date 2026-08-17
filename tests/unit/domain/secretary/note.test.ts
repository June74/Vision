import { describe, expect, it } from "vitest";
import { createSecretaryNote } from "../../../../src/domain/secretary/note";

describe("secretary notes", () => {
  it("creates a bounded protected-content candidate without changing calendar state", () => {
    expect(createSecretaryNote({
      id: "note-1",
      title: "Dataset question",
      body: "Ask whether the training split is frozen.",
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    })).toMatchObject({
      id: "note-1",
      title: "Dataset question",
      body: "Ask whether the training split is frozen.",
      status: "active",
    });
  });

  it("rejects empty protected note content", () => {
    expect(() => createSecretaryNote({
      id: "note-2",
      title: " ",
      body: "body",
      createdAt: new Date("2026-08-16T18:00:00.000Z"),
    })).toThrow("Note input is invalid.");
  });
});
