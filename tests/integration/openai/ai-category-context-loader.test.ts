import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createEventRepository,
  type PlaintextEvent,
} from "../../../src/data/repositories/event-repository";
import { ProviderOrderKeySchema } from "../../../src/domain/events/event";
import { createAiCategoryContextLoader } from "../../../src/server/ai/category-context-loader";
import { createAiEventRepositoryAccess } from "../../../src/server/authorization/event-content-authorization";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const OWNER = "owner-one";
const OTHER_OWNER = "owner-two";
const DESCRIPTION_SENTINEL = "PRIVATE_DESCRIPTION_MUST_NOT_REACH_AI";
const ATTENDEE_SENTINEL = "PRIVATE_ATTENDEE_MUST_NOT_REACH_AI";
let pglite: PGlite;
let database: VisionDatabase;
let keyProvider: Awaited<ReturnType<typeof createTestKeyProvider>>;

function event(
  nodeId: string,
  ownerId: string,
  privacy: PlaintextEvent["privacy"] = "private",
): PlaintextEvent {
  return {
    nodeId,
    ownerId,
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: `calendar-${ownerId}`,
      sourceEventId: `provider-${nodeId}`,
      sourceVersion: ProviderOrderKeySchema.parse("00000000000000000001"),
    },
    startsAt: "2026-07-25T17:00:00.000Z",
    endsAt: "2026-07-25T18:00:00.000Z",
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    domain: "work",
    domainState: "confirmed",
    privacy,
    version: 1,
    title: "Trusted project review",
    description: DESCRIPTION_SENTINEL,
    attendees: [ATTENDEE_SENTINEL],
    location: "PRIVATE_LOCATION_MUST_NOT_REACH_AI",
    meetingLink: "https://example.invalid/private-meeting",
  };
}

async function seed(candidate: PlaintextEvent): Promise<void> {
  await pglite.query(
    `insert into nodes (
       id, owner_id, identity_kind, provider, provider_node_id, node_type,
       domain, domain_state, privacy, provenance, lifecycle,
       created_at, updated_at, valid_from, version, model_confidence
     ) values (
       $1, $2, 'provider', 'google-calendar', $3, 'event',
       'work', 'confirmed', $4, 'provider', 'active',
       $5, $5, $5, 1, null
     )`,
    [
      candidate.nodeId,
      candidate.ownerId,
      `provider-${candidate.nodeId}`,
      candidate.privacy,
      "2026-07-25T16:00:00.000Z",
    ],
  );
  await createEventRepository(
    database,
    keyProvider,
    createTestEventRepositoryAccess(candidate.ownerId),
  ).save(candidate);
}

beforeEach(async () => {
  pglite = new PGlite();
  await pglite.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"),
      "utf8",
    ),
  );
  database = drizzle(pglite) as unknown as VisionDatabase;
  keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
});

afterEach(async () => {
  await pglite.close();
});

describe("AI category context loader over encrypted event storage", () => {
  it("decrypts a same-owner event and minimizes the trusted provider packet", async () => {
    await seed(event("event-one", OWNER));
    const loader = createAiCategoryContextLoader(
      createEventRepository(
        database,
        keyProvider,
        createAiEventRepositoryAccess(OWNER),
      ),
    );

    const request = await loader.load("event-one");

    expect(request).toMatchObject({
      subjectId: "event-one",
      evidenceIds: ["event-status"],
      policyVersion: "ai-category-v1",
      context: {
        eventId: "event-one",
        title: { mode: "plaintext", value: "Trusted project review" },
        evidence: [
          { id: "event-status", fact: "status confirmed busy yes" },
        ],
      },
    });
    expect(JSON.stringify(request)).not.toContain(DESCRIPTION_SENTINEL);
    expect(JSON.stringify(request)).not.toContain(ATTENDEE_SENTINEL);
    expect(JSON.stringify(request)).not.toContain("PRIVATE_LOCATION");
    expect(JSON.stringify(request)).not.toContain("private-meeting");
  });

  it("cannot resolve another owner's opaque event reference", async () => {
    await seed(event("event-other-owner", OTHER_OWNER));
    const loader = createAiCategoryContextLoader(
      createEventRepository(
        database,
        keyProvider,
        createAiEventRepositoryAccess(OWNER),
      ),
    );

    await expect(loader.load("event-other-owner")).resolves.toBeUndefined();
  });

  it("treats a restricted same-owner event as unavailable before decryption", async () => {
    await seed(event("event-restricted", OWNER, "restricted"));
    const loader = createAiCategoryContextLoader(
      createEventRepository(
        database,
        keyProvider,
        createAiEventRepositoryAccess(OWNER),
      ),
    );

    await expect(loader.load("event-restricted")).resolves.toBeUndefined();
  });
});
