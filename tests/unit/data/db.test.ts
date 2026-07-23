import { describe, expect, it } from "vitest";
import { createDb } from "../../../src/data/db";

describe("createDb", () => {
  it("rejects privileged and malformed URLs before creating a database client without echoing secrets", () => {
    const privilegedUrl = "postgresql://neondb_owner:private-password@db.example.test/vision";

    expect(() => createDb(privilegedUrl)).toThrow(/vision_app/i);
    expect(() => createDb(privilegedUrl)).not.toThrow(privilegedUrl);
    expect(() => createDb("not a database url")).toThrow();
  });

  it("accepts the selected application role without opening a live connection", () => {
    expect(() => createDb("postgresql://vision_app:secret@db.example.test/vision")).not.toThrow();
  });
});
