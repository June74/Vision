/** Implements the transaction boundary between pure Vision graph contracts and PostgreSQL rows. */
import { and, eq, sql } from "drizzle-orm";
import {
  VisionEventSchema,
  type VisionEvent,
} from "../../domain/events/event";
import type { Edge } from "../../domain/graph/edge";
import type { NodeEnvelope } from "../../domain/graph/node";
import type { VisionDatabase } from "../db";
import { edges, events, nodes } from "../schema";

/** Reads and writes canonical graph records without allowing providers to define Vision policy. */
export interface GraphRepository {
  upsertNode(node: NodeEnvelope): Promise<UpsertOutcome>;
  upsertEvent(event: VisionEvent): Promise<UpsertOutcome>;
  replaceEdges(ownerId: string, sourceNodeId: string, replacements: Edge[]): Promise<void>;
  getEventByProviderIdentity(ownerId: string, identity: VisionEvent["identity"]): Promise<VisionEvent | undefined>;
}

/**
 * Describes whether the requested version is now represented or an already-persisted newer version won.
 *
 * `applied` includes inserts, updates, and idempotent replays because PostgreSQL cannot portably distinguish those
 * cases from one `ON CONFLICT` result without relying on system columns.
 */
export type UpsertOutcome = "applied" | "no_newer_version";

/** Signals an owner or stable-identity collision without including protected or credential data. */
export class GraphIdentityConflictError extends Error {}

interface AtomicUpsertRow extends Record<string, unknown> {
  ownerId: string;
  stableId: string;
  identitySystem: string;
  identityScope: string | null;
  identityId: string;
  versionState: "requested" | "newer" | "invalid";
}

interface ExpectedUpsertIdentity {
  ownerId: string;
  stableId: string;
  identitySystem: string;
  identityScope: string | null;
  identityId: string;
}

const GRAPH_IDENTITY_CONFLICT_MESSAGE = "Graph identity conflicts with an existing record.";
const INVALID_ATOMIC_RESULT_MESSAGE = "PostgreSQL returned an invalid atomic graph-upsert result.";

/** Classifies only the persisted identity and version relation returned by one atomic upsert statement. */
function classifyAtomicUpsertResult(
  rows: readonly AtomicUpsertRow[],
  expected: ExpectedUpsertIdentity,
): UpsertOutcome {
  if (rows.length !== 1) {
    throw new Error(INVALID_ATOMIC_RESULT_MESSAGE);
  }

  const [persisted] = rows;
  if (
    persisted === undefined ||
    persisted.ownerId !== expected.ownerId ||
    persisted.stableId !== expected.stableId ||
    persisted.identitySystem !== expected.identitySystem ||
    persisted.identityScope !== expected.identityScope ||
    persisted.identityId !== expected.identityId
  ) {
    throw new GraphIdentityConflictError(GRAPH_IDENTITY_CONFLICT_MESSAGE);
  }

  if (persisted.versionState === "requested") {
    return "applied";
  }
  if (persisted.versionState === "newer") {
    return "no_newer_version";
  }
  throw new Error(INVALID_ATOMIC_RESULT_MESSAGE);
}

/** Converts PostgreSQL unique violations into one privacy-safe graph identity error and rethrows other failures. */
function translateUniqueViolation(error: unknown): never {
  let candidate: unknown = error;
  for (let depth = 0; depth < 2; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      break;
    }
    if ("code" in candidate && candidate.code === "23505") {
      throw new GraphIdentityConflictError(GRAPH_IDENTITY_CONFLICT_MESSAGE);
    }
    candidate = "cause" in candidate ? candidate.cause : undefined;
  }
  throw error;
}

/** Persists graph facts with atomic edge replacement and provider-identity lookups. */
export class DrizzleGraphRepository implements GraphRepository {
  /** Creates a repository over the typed, server-only authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /**
   * Atomically makes the requested node version current unless the same identity already has a newer version.
   *
   * The caller must keep one stable Vision ID for each `(ownerId, provider, providerNodeId)` identity.
   */
  async upsertNode(node: NodeEnvelope): Promise<UpsertOutcome> {
    try {
      const result = await this.database.execute<AtomicUpsertRow>(sql`
        with incoming (
          id,
          owner_id,
          identity_kind,
          provider,
          provider_node_id,
          node_type,
          domain,
          domain_state,
          privacy,
          provenance,
          lifecycle,
          created_at,
          updated_at,
          valid_from,
          valid_to,
          version,
          model_confidence
        ) as (
          values (
            ${node.id},
            ${node.ownerId},
            ${node.identity.kind},
            ${node.identity.system},
            ${node.identity.id},
            ${node.nodeType},
            ${node.domain},
            ${node.domainState},
            ${node.privacy},
            ${node.provenance},
            ${node.lifecycle},
            ${new Date(node.createdAt)},
            ${new Date(node.updatedAt)},
            ${new Date(node.validFrom)},
            ${node.validTo ? new Date(node.validTo) : null},
            ${node.version},
            ${node.modelConfidence === undefined ? null : Math.round(node.modelConfidence * 1_000_000)}
          )
        ),
        write as (
          insert into nodes as persisted (
            id,
            owner_id,
            identity_kind,
            provider,
            provider_node_id,
            node_type,
            domain,
            domain_state,
            privacy,
            provenance,
            lifecycle,
            created_at,
            updated_at,
            valid_from,
            valid_to,
            version,
            model_confidence
          )
          select * from incoming
          on conflict (owner_id, provider, provider_node_id) do update set
            domain = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.domain
              else persisted.domain
            end,
            domain_state = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.domain_state
              else persisted.domain_state
            end,
            privacy = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.privacy
              else persisted.privacy
            end,
            provenance = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.provenance
              else persisted.provenance
            end,
            lifecycle = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.lifecycle
              else persisted.lifecycle
            end,
            updated_at = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.updated_at
              else persisted.updated_at
            end,
            valid_from = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.valid_from
              else persisted.valid_from
            end,
            valid_to = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.valid_to
              else persisted.valid_to
            end,
            version = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.version
              else persisted.version
            end,
            model_confidence = case
              when persisted.id = excluded.id and persisted.version < excluded.version
                then excluded.model_confidence
              else persisted.model_confidence
            end
          returning
            persisted.id as stable_id,
            persisted.owner_id,
            persisted.provider,
            persisted.provider_node_id,
            persisted.version
        )
        select
          write.owner_id as "ownerId",
          write.stable_id as "stableId",
          write.provider as "identitySystem",
          null::text as "identityScope",
          write.provider_node_id as "identityId",
          case
            when write.version = incoming.version then 'requested'
            when write.version > incoming.version then 'newer'
            else 'invalid'
          end as "versionState"
        from write
        cross join incoming
      `);

      return classifyAtomicUpsertResult(result.rows, {
        ownerId: node.ownerId,
        stableId: node.id,
        identitySystem: node.identity.system,
        identityScope: null,
        identityId: node.identity.id,
      });
    } catch (error) {
      return translateUniqueViolation(error);
    }
  }

  /**
   * Atomically makes an order-preserving provider version current unless a newer provider version already exists.
   *
   * Callers must persist the pre-existing same-owner event node with `upsertNode` before calling this method.
   * Provider adapters must supply `sourceVersion` tokens whose PostgreSQL text order matches provider change order.
   */
  async upsertEvent(event: VisionEvent): Promise<UpsertOutcome> {
    try {
      const result = await this.database.execute<AtomicUpsertRow>(sql`
        with incoming (
          node_id,
          owner_id,
          provider,
          provider_calendar_id,
          provider_event_id,
          provider_version,
          starts_at,
          ends_at,
          time_zone,
          busy,
          status,
          recurrence_id
        ) as (
          values (
            ${event.nodeId},
            ${event.ownerId},
            ${event.identity.sourceSystem},
            ${event.identity.sourceCalendarId},
            ${event.identity.sourceEventId},
            ${event.identity.sourceVersion},
            ${new Date(event.startsAt)},
            ${new Date(event.endsAt)},
            ${event.timeZone},
            ${event.busy},
            ${event.status},
            ${event.recurrenceId ?? null}
          )
        ),
        write as (
          insert into events as persisted (
            node_id,
            owner_id,
            provider,
            provider_calendar_id,
            provider_event_id,
            provider_version,
            starts_at,
            ends_at,
            time_zone,
            busy,
            status,
            recurrence_id
          )
          select * from incoming
          on conflict (provider, provider_calendar_id, provider_event_id) do update set
            provider_version = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.provider_version
              else persisted.provider_version
            end,
            starts_at = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.starts_at
              else persisted.starts_at
            end,
            ends_at = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.ends_at
              else persisted.ends_at
            end,
            time_zone = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.time_zone
              else persisted.time_zone
            end,
            busy = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.busy
              else persisted.busy
            end,
            status = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.status
              else persisted.status
            end,
            recurrence_id = case
              when persisted.owner_id = excluded.owner_id
                and persisted.node_id = excluded.node_id
                and persisted.provider_version < excluded.provider_version
                then excluded.recurrence_id
              else persisted.recurrence_id
            end
          returning
            persisted.node_id as stable_id,
            persisted.owner_id,
            persisted.provider,
            persisted.provider_calendar_id,
            persisted.provider_event_id,
            persisted.provider_version
        )
        select
          write.owner_id as "ownerId",
          write.stable_id as "stableId",
          write.provider as "identitySystem",
          write.provider_calendar_id as "identityScope",
          write.provider_event_id as "identityId",
          case
            when write.provider_version = incoming.provider_version then 'requested'
            when write.provider_version > incoming.provider_version then 'newer'
            else 'invalid'
          end as "versionState"
        from write
        cross join incoming
      `);

      return classifyAtomicUpsertResult(result.rows, {
        ownerId: event.ownerId,
        stableId: event.nodeId,
        identitySystem: event.identity.sourceSystem,
        identityScope: event.identity.sourceCalendarId,
        identityId: event.identity.sourceEventId,
      });
    } catch (error) {
      return translateUniqueViolation(error);
    }
  }

  /** Atomically replaces one source node's relationships after checking their declared source. */
  async replaceEdges(ownerId: string, sourceNodeId: string, replacements: Edge[]): Promise<void> {
    for (const edge of replacements) {
      if (edge.sourceNodeId !== sourceNodeId) {
        throw new Error("Every replacement edge must use the requested source node.");
      }
    }

    await this.database.transaction(async (transaction) => {
      await transaction.delete(edges).where(and(eq(edges.ownerId, ownerId), eq(edges.sourceNodeId, sourceNodeId)));

      if (replacements.length > 0) {
        await transaction.insert(edges).values(
          replacements.map((edge) => ({
            id: edge.id,
            ownerId,
            sourceNodeId: edge.sourceNodeId,
            sourceNodeType: edge.sourceType,
            destinationNodeId: edge.destinationNodeId,
            destinationNodeType: edge.destinationType,
            relation: edge.relation,
            origin: edge.origin,
            evidence: edge.evidence ?? null,
            confidence: edge.confidence === undefined ? null : Math.round(edge.confidence * 1_000_000),
            lifecycle: edge.lifecycle,
            privacy: edge.privacy,
            validFrom: edge.validFrom ? new Date(edge.validFrom) : null,
            validTo: edge.validTo ? new Date(edge.validTo) : null,
            version: edge.version,
          })),
        );
      }
    });
  }

  /** Returns one planning-safe event selected by its complete provider identity for its owner. */
  async getEventByProviderIdentity(ownerId: string, identity: VisionEvent["identity"]): Promise<VisionEvent | undefined> {
    const [row] = await this.database
      .select({
        event: {
          nodeId: events.nodeId,
          ownerId: events.ownerId,
          provider: events.provider,
          providerCalendarId: events.providerCalendarId,
          providerEventId: events.providerEventId,
          providerVersion: events.providerVersion,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          timeZone: events.timeZone,
          busy: events.busy,
          status: events.status,
          recurrenceId: events.recurrenceId,
        },
        node: {
          domain: nodes.domain,
          domainState: nodes.domainState,
          privacy: nodes.privacy,
          version: nodes.version,
        },
      })
      .from(events)
      .innerJoin(nodes, and(eq(events.nodeId, nodes.id), eq(events.ownerId, nodes.ownerId)))
      .where(
        and(
          eq(events.ownerId, ownerId),
          eq(events.provider, identity.sourceSystem),
          eq(events.providerCalendarId, identity.sourceCalendarId),
          eq(events.providerEventId, identity.sourceEventId),
        ),
      )
      .limit(1);

    if (!row) {
      return undefined;
    }

    const { event, node } = row;

    return VisionEventSchema.parse({
      nodeId: event.nodeId,
      ownerId: event.ownerId,
      identity: {
        sourceSystem: event.provider,
        sourceCalendarId: event.providerCalendarId,
        sourceEventId: event.providerEventId,
        sourceVersion: event.providerVersion,
      },
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timeZone: event.timeZone,
      busy: event.busy,
      status: event.status as VisionEvent["status"],
      recurrenceId: event.recurrenceId ?? undefined,
      domain: node.domain as VisionEvent["domain"],
      domainState: node.domainState as VisionEvent["domainState"],
      privacy: node.privacy as VisionEvent["privacy"],
      version: node.version,
    });
  }
}
