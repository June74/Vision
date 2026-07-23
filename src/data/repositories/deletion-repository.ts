/** Persists owner-bound recovery and system-authorized purge through lock-safe PostgreSQL statements. */
import { sql } from "drizzle-orm";
import { markDeleted as createDeletionRecord, type RecoverableDeletion } from "../../domain/lifecycle/deletion";
import {
  isVerifiedDeletionPurgeAccess,
  isVerifiedDeletionRepositoryAccess,
  type VerifiedDeletionPurgeAccess,
  type VerifiedDeletionRepositoryAccess,
} from "../../server/authorization/deletion-repository-authorization";
import type { VisionDatabase } from "../db";

/** Result returned by a global system purge after every successfully claimed deletion episode is removed. */
export interface PurgeExpiredDeletionsResult {
  readonly purgedNodeIds: string[];
}

/** User-request surface scoped to one verified authenticated owner. */
export interface DeletionRepository {
  markDeleted(nodeId: string, deletedAt: Date, purgeAfter?: Date): Promise<RecoverableDeletion>;
  restoreDeleted(nodeId: string, now: Date): Promise<boolean>;
}

/** System-only surface intentionally separated from ordinary owner requests. */
export interface DeletionPurgeRepository {
  purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult>;
}

/** Reports a lifecycle transition that is unavailable in the caller's verified owner scope. */
export class DeletionStateConflictError extends Error {
  constructor() {
    super("Deletion lifecycle transition is not available.");
    this.name = "DeletionStateConflictError";
  }
}

/** Reports a forged or missing owner/system capability without leaking which authority was expected. */
export class DeletionOwnerAccessDeniedError extends Error {
  constructor() {
    super("Deletion repository access is not authorized.");
    this.name = "DeletionOwnerAccessDeniedError";
  }
}

type PurgedRow = Record<string, unknown>;

/** Owner-bound repository whose user transitions always predicate node and recovery rows by authenticated owner ID. */
class DrizzleDeletionRepository implements DeletionRepository {
  constructor(
    private readonly database: VisionDatabase,
    private readonly access: VerifiedDeletionRepositoryAccess,
  ) {
    if (!isVerifiedDeletionRepositoryAccess(access)) {
      throw new DeletionOwnerAccessDeniedError();
    }
  }

  /** Marks only this owner's active node deleted and creates the exact recovery episode in one PostgreSQL statement. */
  async markDeleted(nodeId: string, deletedAt: Date, purgeAfter?: Date): Promise<RecoverableDeletion> {
    const deletion = createDeletionRecord(nodeId, deletedAt, purgeAfter);
    const result = await this.database.execute(sql`
      with changed_node as (
        update nodes
        set lifecycle = 'deleted', updated_at = ${deletion.deletedAt}::timestamptz, version = version + 1
        where id = ${deletion.nodeId}
          and owner_id = ${this.access.authenticatedOwnerId}
          and lifecycle = 'active'
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

  /** Locks recovery then node, revalidates the pre-deadline state, and restores exactly one owner-bound record. */
  async restoreDeleted(nodeId: string, now: Date): Promise<boolean> {
    const requested = createRestoreRequest(nodeId, now);
    const result = await this.database.execute(sql`
      with locked as (
        select recovery.node_id, recovery.owner_id, recovery.purge_after
        from recoverable_deletions recovery
        inner join nodes node on node.id = recovery.node_id and node.owner_id = recovery.owner_id
        where recovery.node_id = ${requested.nodeId}
          and recovery.owner_id = ${this.access.authenticatedOwnerId}
          and node.lifecycle = 'deleted'
          and recovery.purge_after > ${requested.now}::timestamptz
        order by recovery.node_id
        for update of recovery, node
      ),
      eligible as (
        select locked.node_id, locked.owner_id
        from locked
        inner join recoverable_deletions recovery on recovery.node_id = locked.node_id and recovery.owner_id = locked.owner_id
        inner join nodes node on node.id = locked.node_id and node.owner_id = locked.owner_id
        where node.lifecycle = 'deleted'
          and recovery.purge_after > ${requested.now}::timestamptz
      ),
      restored as (
        update nodes node
        set lifecycle = 'active', updated_at = ${requested.now}::timestamptz, version = node.version + 1
        from eligible
        where node.id = eligible.node_id
          and node.owner_id = eligible.owner_id
          and node.lifecycle = 'deleted'
          and exists (
            select 1 from recoverable_deletions recovery
            where recovery.node_id = eligible.node_id
              and recovery.owner_id = eligible.owner_id
              and recovery.purge_after > ${requested.now}::timestamptz
          )
        returning node.id, node.owner_id
      ),
      removed_recovery as (
        delete from recoverable_deletions recovery
        using restored
        where recovery.node_id = restored.id
          and recovery.owner_id = restored.owner_id
          and recovery.purge_after > ${requested.now}::timestamptz
        returning recovery.node_id
      )
      select node_id as "nodeId" from removed_recovery
    `);
    return result.rows.length === 1;
  }
}

/** System-only repository whose global purge locks recovery/node pairs in node-ID order before all destructive work. */
class DrizzleDeletionPurgeRepository implements DeletionPurgeRepository {
  constructor(
    private readonly database: VisionDatabase,
    access: VerifiedDeletionPurgeAccess,
  ) {
    if (!isVerifiedDeletionPurgeAccess(access)) {
      throw new DeletionOwnerAccessDeniedError();
    }
  }

  /** Lets the first locker win: a waiting restore or purge revalidates and then returns no transition or mutation. */
  async purgeExpiredDeletions(now: Date): Promise<PurgeExpiredDeletionsResult> {
    const requested = createPurgeRequest(now);
    const result = await this.database.execute<PurgedRow>(sql`
      with locked as (
        select recovery.node_id, recovery.owner_id, recovery.deleted_at, recovery.purge_after
        from recoverable_deletions recovery
        inner join nodes node on node.id = recovery.node_id and node.owner_id = recovery.owner_id
        where recovery.purge_after <= ${requested.now}::timestamptz
          and node.lifecycle = 'deleted'
        order by recovery.node_id
        for update of recovery, node
      ),
      eligible as (
        select locked.node_id, locked.owner_id, locked.deleted_at
        from locked
        inner join recoverable_deletions recovery on recovery.node_id = locked.node_id and recovery.owner_id = locked.owner_id
        inner join nodes node on node.id = locked.node_id and node.owner_id = locked.owner_id
        where node.lifecycle = 'deleted'
          and recovery.purge_after <= ${requested.now}::timestamptz
      ),
      purge_audit as (
        insert into audit_events (id, owner_id, node_id, actor_type, action, outcome, occurred_at)
        select
          'purge_' || md5(eligible.owner_id || chr(31) || eligible.node_id || chr(31) || eligible.deleted_at::text),
          eligible.owner_id, null, 'system', 'record.purged', 'succeeded', ${requested.now}::timestamptz
        from eligible
        returning id
      ),
      audit_guard as (
        select case
          when (select count(*) from purge_audit) = (select count(*) from eligible) then true
          else (select 1 / (count(*) - count(*)) = 1 from purge_audit)
        end as allowed
      ),
      claimed_recovery as (
        delete from recoverable_deletions recovery
        using eligible, audit_guard, nodes node
        where audit_guard.allowed
          and recovery.node_id = eligible.node_id
          and recovery.owner_id = eligible.owner_id
          and node.id = eligible.node_id
          and node.owner_id = eligible.owner_id
          and node.lifecycle = 'deleted'
          and recovery.purge_after <= ${requested.now}::timestamptz
        returning recovery.node_id, recovery.owner_id
      ),
      detached_audit as (
        update audit_events audit
        set node_id = null
        from claimed_recovery
        where audit.node_id = claimed_recovery.node_id and audit.owner_id = claimed_recovery.owner_id
        returning audit.id
      ),
      removed_edges as (
        delete from edges edge
        using claimed_recovery
        where edge.owner_id = claimed_recovery.owner_id
          and (edge.source_node_id = claimed_recovery.node_id or edge.destination_node_id = claimed_recovery.node_id)
        returning edge.id
      ),
      removed_events as (
        delete from events event
        using claimed_recovery
        where event.node_id = claimed_recovery.node_id and event.owner_id = claimed_recovery.owner_id
        returning event.node_id
      ),
      removed_nodes as (
        delete from nodes node
        using claimed_recovery
        where node.id = claimed_recovery.node_id
          and node.owner_id = claimed_recovery.owner_id
          and node.lifecycle = 'deleted'
        returning node.id
      )
      select id as "nodeId" from removed_nodes order by id
    `);
    return { purgedNodeIds: result.rows.map(decodePurgedNodeId) };
  }
}

/** Creates an owner-scoped repository only from a registered verified owner capability. */
export function createDeletionRepository(
  database: VisionDatabase,
  access: VerifiedDeletionRepositoryAccess,
): DeletionRepository {
  if (!isVerifiedDeletionRepositoryAccess(access)) {
    throw new DeletionOwnerAccessDeniedError();
  }
  return new DrizzleDeletionRepository(database, access);
}

/** Creates the distinct global purge repository only from the registered trusted scheduler capability. */
export function createDeletionPurgeRepository(
  database: VisionDatabase,
  access: VerifiedDeletionPurgeAccess,
): DeletionPurgeRepository {
  if (!isVerifiedDeletionPurgeAccess(access)) {
    throw new DeletionOwnerAccessDeniedError();
  }
  return new DrizzleDeletionPurgeRepository(database, access);
}

/** Validates the only non-content restore inputs before owner-scoped SQL is assembled. */
function createRestoreRequest(nodeId: string, now: Date): { readonly nodeId: string; readonly now: Date } {
  const placeholder = createDeletionRecord(nodeId, now);
  return { nodeId: placeholder.nodeId, now: placeholder.deletedAt };
}

/** Validates the UTC purge time before it reaches the system-authorized PostgreSQL boundary. */
function createPurgeRequest(now: Date): { readonly now: Date } {
  const placeholder = createDeletionRecord("purge_request", now);
  return { now: placeholder.deletedAt };
}

/** Decodes an opaque node ID returned by the atomic system purge statement without coercion. */
function decodePurgedNodeId(row: PurgedRow): string {
  if (typeof row.nodeId !== "string" || row.nodeId.length === 0) {
    throw new Error("Purge returned an invalid node ID.");
  }
  return row.nodeId;
}
