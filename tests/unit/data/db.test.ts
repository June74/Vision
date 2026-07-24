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
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neon: databaseBoundary.neon,
  types: {
    builtins: { BYTEA: 17 },
    getTypeParser: databaseBoundary.getDefaultTypeParser,
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

  it("keeps Neon bytea as canonical text while preserving every default non-binary parser", () => {
    const databaseUrl =
      "postgresql://vision_app:secret@db.example.test/vision";

    createDb(databaseUrl);

    expect(databaseBoundary.neon).toHaveBeenCalledWith(
      databaseUrl,
      expect.objectContaining({
        types: expect.objectContaining({
          getTypeParser: expect.any(Function),
        }),
      }),
    );
    const options = databaseBoundary.neon.mock.calls[0]?.[1] as {
      types: {
        getTypeParser: (
          id: number,
          format?: "text" | "binary",
        ) => (value: string) => unknown;
      };
    };
    expect(options.types.getTypeParser(17, "text")("\\x00ff")).toBe(
      "\\x00ff",
    );
    expect(options.types.getTypeParser(25, "text")).toBe(
      databaseBoundary.defaultParser,
    );
  });
});
