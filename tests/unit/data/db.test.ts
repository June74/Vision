import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseBoundary = vi.hoisted(() => {
  const defaultParser = (value: string) => `parsed:${value}`;
  return {
    defaultParser,
    drizzle: vi.fn(({ client }: { client: unknown }) => ({ client })),
    neon: vi.fn((_databaseUrl: string, _options?: unknown) => ({
      kind: "neon-client",
    })),
    getDefaultTypeParser: vi.fn(() => defaultParser),
    setTypeParser: vi.fn(),
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neon: databaseBoundary.neon,
  types: {
    builtins: { BYTEA: 17 },
    getTypeParser: databaseBoundary.getDefaultTypeParser,
    setTypeParser: databaseBoundary.setTypeParser,
  },
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: databaseBoundary.drizzle,
}));

import { createDb } from "../../../src/data/db";

describe("createDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects privileged and malformed URLs before creating a database client without echoing secrets", () => {
    const privilegedUrl = "postgresql://neondb_owner:private-password@db.example.test/vision";

    expect(() => createDb(privilegedUrl)).toThrow(/vision_app/i);
    expect(() => createDb(privilegedUrl)).not.toThrow(privilegedUrl);
    expect(() => createDb("not a database url")).toThrow();
  });

  it("accepts the selected application role without opening a live connection", () => {
    expect(() => createDb("postgresql://vision_app:secret@db.example.test/vision")).not.toThrow();
  });

  it("registers canonical text parsing for Neon bytea before creating the client", () => {
    const databaseUrl =
      "postgresql://vision_app:secret@db.example.test/vision";

    createDb(databaseUrl);

    expect(databaseBoundary.setTypeParser).toHaveBeenCalledWith(
      17,
      "text",
      expect.any(Function),
    );
    const parser = databaseBoundary.setTypeParser.mock.calls[0]?.[2] as (
      value: string,
    ) => string;
    expect(parser("\\x00ff")).toBe("\\x00ff");
    expect(databaseBoundary.neon).toHaveBeenCalledWith(databaseUrl);
  });
});
