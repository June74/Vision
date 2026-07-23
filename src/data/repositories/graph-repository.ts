/** Implements the transaction boundary between pure Vision graph contracts and PostgreSQL rows. */
import { and, eq, sql } from "drizzle-orm";
import type { VisionEvent } from "../../domain/events/event";
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

/** Describes the observable result of a safe graph upsert. */
export type UpsertOutcome = "inserted" | "updated" | "no_newer_version";

/** Signals an owner or stable-identity collision without including protected or credential data. */
export class GraphIdentityConflictError extends Error {}

/** Persists graph facts with atomic edge replacement and provider-identity lookups. */
export class DrizzleGraphRepository implements GraphRepository {
  /** Creates a repository over the typed, server-only authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /**
   * Inserts a node or advances its owner-scoped natural identity when the stable ID and version agree.
   *
   * The caller must keep one stable Vision ID for each `(ownerId, provider, providerNodeId)` identity.
   */
  async upsertNode(node: NodeEnvelope): Promise<UpsertOutcome> {
    const [naturalIdentity] = await this.database
      .select({ id: nodes.id, version: nodes.version })
      .from(nodes)
      .where(and(eq(nodes.ownerId, node.ownerId), eq(nodes.provider, node.identity.system), eq(nodes.providerNodeId, node.identity.id)))
      .limit(1);
    const [globalId] = await this.database.select({ ownerId: nodes.ownerId }).from(nodes).where(eq(nodes.id, node.id)).limit(1);

    if (globalId && globalId.ownerId !== node.ownerId) {
      throw new GraphIdentityConflictError("Node ID is already owned by another account.");
    }
    if (naturalIdentity && naturalIdentity.id !== node.id) {
      throw new GraphIdentityConflictError("Node identity is already associated with a different stable ID.");
    }
    if (naturalIdentity && naturalIdentity.version >= node.version) {
      return "no_newer_version";
    }

    const changed = await this.database
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
        target: [nodes.ownerId, nodes.provider, nodes.providerNodeId],
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
        where: and(eq(nodes.ownerId, node.ownerId), eq(nodes.id, node.id), sql`${nodes.version} < ${node.version}`),
      })
      .returning({ id: nodes.id });

    if (changed.length === 0) {
      // Neon HTTP has no interactive transaction here; re-read only to classify a concurrent safe no-op or collision.
      const [observed] = await this.database
        .select({ id: nodes.id, version: nodes.version })
        .from(nodes)
        .where(and(eq(nodes.ownerId, node.ownerId), eq(nodes.provider, node.identity.system), eq(nodes.providerNodeId, node.identity.id)))
        .limit(1);
      if (observed && observed.id !== node.id) {
        throw new GraphIdentityConflictError("Node identity is already associated with a different stable ID.");
      }
      return "no_newer_version";
    }
    return naturalIdentity ? "updated" : "inserted";
  }

  /**
   * Inserts planning-safe event data or advances it only when the provider version changes for the same owner.
   *
   * Callers must persist the pre-existing same-owner event node with `upsertNode` before calling this method.
   */
  async upsertEvent(event: VisionEvent): Promise<UpsertOutcome> {
    const [existing] = await this.database
      .select({ ownerId: events.ownerId, providerVersion: events.providerVersion })
      .from(events)
      .where(and(eq(events.provider, event.identity.sourceSystem), eq(events.providerCalendarId, event.identity.sourceCalendarId), eq(events.providerEventId, event.identity.sourceEventId)))
      .limit(1);
    if (existing && existing.ownerId !== event.ownerId) {
      throw new GraphIdentityConflictError("Provider event identity is already owned by another account.");
    }
    if (existing && existing.providerVersion === event.identity.sourceVersion) {
      return "no_newer_version";
    }

    const changed = await this.database
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
          providerVersion: event.identity.sourceVersion,
          startsAt: new Date(event.startsAt),
          endsAt: new Date(event.endsAt),
          timeZone: event.timeZone,
          busy: event.busy,
          status: event.status,
          recurrenceId: event.recurrenceId ?? null,
        },
        where: and(eq(events.ownerId, event.ownerId), sql`${events.providerVersion} <> ${event.identity.sourceVersion}`),
      })
      .returning({ nodeId: events.nodeId });

    if (changed.length === 0) {
      const [observed] = await this.database
        .select({ ownerId: events.ownerId })
        .from(events)
        .where(and(eq(events.provider, event.identity.sourceSystem), eq(events.providerCalendarId, event.identity.sourceCalendarId), eq(events.providerEventId, event.identity.sourceEventId)))
        .limit(1);
      if (observed && observed.ownerId !== event.ownerId) {
        throw new GraphIdentityConflictError("Provider event identity is already owned by another account.");
      }
      return "no_newer_version";
    }
    return existing ? "updated" : "inserted";
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
