/** Persists recoverable deletion, restoration, and permanent purge as PostgreSQL atomic statements. */
import { sql } from "drizzle-orm";
import { markDeleted as createDeletionRecord, type RecoverableDeletion } from "../../domain/lifecycle/deletion";
import type { VisionDatabase } from "../db";

/** Result returned by a purge run after every eligible node has been removed. */
export interface PurgeExpiredDeletionsResult {
  readonly purgedNodeIds: string[];
}

/** Server-side persistence boundary for the fixed recoverable-deletion lifecycle. */
export interface DeletionRepository {
  markDeleted(nodeId: string, deletedAt: Date, purgeAfter?: Date): Promise<RecoverableDeletion>;
  restoreDeleted(nodeId: string, now: Date): Promise<boolean>;
  purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult>;
}

/** Reports a requested lifecycle transition that does not match the authoritative row state. */
export class DeletionStateConflictError extends Error {
  constructor() {
    super("Deletion lifecycle transition is not available.");
    this.name = "DeletionStateConflictError";
  }
}

type PurgedRow = Record<string, unknown>;

/** Concrete Neon/Drizzle adapter whose data-modifying CTEs are single PostgreSQL transactions. */
export class DrizzleDeletionRepository implements DeletionRepository {
  constructor(private readonly database: VisionDatabase) {}

  /** Marks an active node deleted and records its exact recovery deadline without moving protected ciphertext. */
  async markDeleted(nodeId: string, deletedAt: Date, purgeAfter?: Date): Promise<RecoverableDeletion> {
    const deletion = createDeletionRecord(nodeId, deletedAt, purgeAfter);
    const result = await this.database.execute(sql`
      with changed_node as (
        update nodes
        set lifecycle = 'deleted', updated_at = ${deletion.deletedAt}::timestamptz, version = version + 1
        where id = ${deletion.nodeId} and lifecycle = 'active'
        returning id, owner_id
      ),
      recovery as (
        insert into recoverable_deletions (node_id, owner_id, deleted_at, purge_after)
        select id, owner_id, ${deletion.deletedAt}::timestamptz, ${deletion.purgeAfter}::timestamptz
        from changed_node
        returning node_id
      )
      select node_id as "nodeId" from recovery
    `);
    if (result.rows.length !== 1) {
      throw new DeletionStateConflictError();
    }
    return deletion;
  }

  /** Restores a deleted node only before expiry and deletes its recovery marker without reading or rewriting ciphertext. */
  async restoreDeleted(nodeId: string, now: Date): Promise<boolean> {
    const requested = createRestoreRequest(nodeId, now);
    const result = await this.database.execute(sql`
      with eligible as (
        select recovery.node_id, recovery.owner_id
        from recoverable_deletions recovery
        inner join nodes node on node.id = recovery.node_id and node.owner_id = recovery.owner_id
        where recovery.node_id = ${requested.nodeId}
          and node.lifecycle = 'deleted'
          and ${requested.now}::timestamptz < recovery.purge_after
      ),
      restored as (
        update nodes node
        set lifecycle = 'active', updated_at = ${requested.now}::timestamptz, version = node.version + 1
        from eligible
        where node.id = eligible.node_id and node.owner_id = eligible.owner_id
        returning node.id
      ),
      removed_recovery as (
        delete from recoverable_deletions recovery
        using restored
        where recovery.node_id = restored.id
        returning recovery.node_id
      )
      select node_id as "nodeId" from removed_recovery
    `);
    return result.rows.length === 1;
  }

  /** Purges every due record with one statement: detach safe audit facts, remove data rows, then add a safe purge fact. */
  async purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult> {
    const requested = createPurgeRequest(now);
    const result = await this.database.execute<PurgedRow>(sql`
      with expired as (
        select recovery.node_id, recovery.owner_id
        from recoverable_deletions recovery
        inner join nodes node on node.id = recovery.node_id and node.owner_id = recovery.owner_id
        where recovery.purge_after <= ${requested.now}::timestamptz
          and node.lifecycle = 'deleted'
      ),
      detached_audit as (
        update audit_events audit
        set node_id = null
        from expired
        where audit.node_id = expired.node_id and audit.owner_id = expired.owner_id
        returning audit.id
      ),
      removed_edges as (
        delete from edges edge
        using expired
        where edge.owner_id = expired.owner_id
          and (edge.source_node_id = expired.node_id or edge.destination_node_id = expired.node_id)
        returning edge.id
      ),
      removed_events as (
        delete from events event
        using expired
        where event.node_id = expired.node_id and event.owner_id = expired.owner_id
        returning event.node_id
      ),
      removed_recovery as (
        delete from recoverable_deletions recovery
        using expired
        where recovery.node_id = expired.node_id and recovery.owner_id = expired.owner_id
        returning recovery.node_id
      ),
      purge_audit as (
        insert into audit_events (id, owner_id, node_id, actor_type, action, outcome, occurred_at)
        select 'purge_' || md5(expired.node_id), expired.owner_id, null, 'system', 'record.purged', 'succeeded', ${requested.now}::timestamptz
        from expired
        on conflict (id) do nothing
        returning id
      ),
      removed_nodes as (
        delete from nodes node
        using expired
        where node.id = expired.node_id and node.owner_id = expired.owner_id
        returning node.id
      )
      select id as "nodeId" from removed_nodes order by id
    `);
    return { purgedNodeIds: result.rows.map(decodePurgedNodeId) };
  }
}

/** Creates the production deletion repository without exposing a client-side database path. */
export function createDeletionRepository(database: VisionDatabase): DeletionRepository {
  return new DrizzleDeletionRepository(database);
}

/** Validates the only non-content restore inputs before a statement is assembled. */
function createRestoreRequest(nodeId: string, now: Date): { readonly nodeId: string; readonly now: Date } {
  const placeholder = createDeletionRecord(nodeId, now);
  return { nodeId: placeholder.nodeId, now: placeholder.deletedAt };
}

/** Validates the UTC purge time using the pure lifecycle contract. */
function createPurgeRequest(now: Date): { readonly now: Date } {
  const placeholder = createDeletionRecord("purge_request", now);
  return { now: placeholder.deletedAt };
}

/** Decodes an opaque node ID returned by the atomic purge statement without coercion. */
function decodePurgedNodeId(row: PurgedRow): string {
  if (typeof row.nodeId !== "string" || row.nodeId.length === 0) {
    throw new Error("Purge returned an invalid node ID.");
  }
  return row.nodeId;
}
