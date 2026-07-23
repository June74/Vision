/** Implements the transaction boundary between pure Vision graph contracts and PostgreSQL rows. */
import { and, eq, sql } from "drizzle-orm";
import type { VisionEvent } from "../../domain/events/event";
import type { Edge } from "../../domain/graph/edge";
import type { NodeEnvelope } from "../../domain/graph/node";
import type { VisionDatabase } from "../db";
import { edges, events, nodes } from "../schema";

/** Reads and writes canonical graph records without allowing providers to define Vision policy. */
export interface GraphRepository {
  upsertNode(node: NodeEnvelope): Promise<void>;
  upsertEvent(event: VisionEvent): Promise<void>;
  replaceEdges(ownerId: string, sourceNodeId: string, replacements: Edge[]): Promise<void>;
  getEventByProviderIdentity(ownerId: string, identity: VisionEvent["identity"]): Promise<VisionEvent | undefined>;
}

/** Persists graph facts with atomic edge replacement and provider-identity lookups. */
export class DrizzleGraphRepository implements GraphRepository {
  /** Creates a repository over the typed, server-only authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /** Inserts a node or advances it only when the supplied version is newer. */
  async upsertNode(node: NodeEnvelope): Promise<void> {
    await this.database
      .insert(nodes)
      .values({
        id: node.id,
        ownerId: node.ownerId,
        identityKind: node.identity.kind,
        provider: node.identity.system,
        providerNodeId: node.identity.id,
        nodeType: node.nodeType,
        domain: node.domain,
        domainState: node.domainState,
        privacy: node.privacy,
        provenance: node.provenance,
        lifecycle: node.lifecycle,
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(node.updatedAt),
        validFrom: new Date(node.validFrom),
        validTo: node.validTo ? new Date(node.validTo) : null,
        version: node.version,
        modelConfidence: node.modelConfidence === undefined ? null : Math.round(node.modelConfidence * 1_000_000),
      })
      .onConflictDoUpdate({
        target: nodes.id,
        set: {
          domain: node.domain,
          domainState: node.domainState,
          privacy: node.privacy,
          provenance: node.provenance,
          lifecycle: node.lifecycle,
          updatedAt: new Date(node.updatedAt),
          validFrom: new Date(node.validFrom),
          validTo: node.validTo ? new Date(node.validTo) : null,
          version: node.version,
          modelConfidence: node.modelConfidence === undefined ? null : Math.round(node.modelConfidence * 1_000_000),
        },
        where: sql`${nodes.version} < ${node.version}`,
      });
  }

  /** Inserts planning-safe event data or advances it only when the provider version changes. */
  async upsertEvent(event: VisionEvent): Promise<void> {
    await this.database
      .insert(events)
      .values({
        nodeId: event.nodeId,
        ownerId: event.ownerId,
        provider: event.identity.sourceSystem,
        providerCalendarId: event.identity.sourceCalendarId,
        providerEventId: event.identity.sourceEventId,
        providerVersion: event.identity.sourceVersion,
        startsAt: new Date(event.startsAt),
        endsAt: new Date(event.endsAt),
        timeZone: event.timeZone,
        busy: event.busy,
        status: event.status,
        recurrenceId: event.recurrenceId ?? null,
      })
      .onConflictDoUpdate({
        target: [events.provider, events.providerCalendarId, events.providerEventId],
        set: {
          nodeId: event.nodeId,
          ownerId: event.ownerId,
          providerVersion: event.identity.sourceVersion,
          startsAt: new Date(event.startsAt),
          endsAt: new Date(event.endsAt),
          timeZone: event.timeZone,
          busy: event.busy,
          status: event.status,
          recurrenceId: event.recurrenceId ?? null,
        },
        where: sql`${events.providerVersion} <> ${event.identity.sourceVersion}`,
      });
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
      .select()
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

    const { events: event, nodes: node } = row;

    return {
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
    };
  }
}
