/** Defines owner-scoped local secretary records with encrypted user content. */
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ciphertext } from "./nodes";

/** Stores captured text encrypted under the owner's personal protected-data key. */
export const secretaryCaptures = pgTable(
  "secretary_captures",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    kind: text("kind").notNull(),
    ambiguity: text("ambiguity").notNull(),
    contentEnvelope: ciphertext("content_envelope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("secretary_captures_owner_id_unique").on(table.ownerId, table.id),
    index("secretary_captures_owner_created_idx").on(table.ownerId, table.createdAt),
    check("secretary_captures_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("secretary_captures_kind_valid", sql`${table.kind} in ('task', 'note', 'calendar_candidate', 'ambiguous')`),
    check("secretary_captures_ambiguity_valid", sql`${table.ambiguity} in ('none', 'needs_clarification')`),
  ],
);

/** Stores local task metadata and an encrypted task title. */
export const secretaryTasks = pgTable(
  "secretary_tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    titleEnvelope: ciphertext("title_envelope").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    timeZone: text("time_zone").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("secretary_tasks_owner_id_unique").on(table.ownerId, table.id),
    index("secretary_tasks_owner_due_idx").on(table.ownerId, table.dueAt),
    check("secretary_tasks_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("secretary_tasks_time_zone_non_empty", sql`${table.timeZone} <> ''`),
    check("secretary_tasks_status_valid", sql`${table.status} in ('open', 'completed')`),
    check("secretary_tasks_completion_consistent", sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`),
  ],
);

/** Stores protected note title/body while keeping local timestamps queryable. */
export const secretaryNotes = pgTable(
  "secretary_notes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    titleEnvelope: ciphertext("title_envelope").notNull(),
    bodyEnvelope: ciphertext("body_envelope").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("secretary_notes_owner_id_unique").on(table.ownerId, table.id),
    index("secretary_notes_owner_updated_idx").on(table.ownerId, table.updatedAt),
    check("secretary_notes_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("secretary_notes_status_valid", sql`${table.status} = 'active'`),
  ],
);
