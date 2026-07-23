CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"node_id" text,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"provider" text,
	"error_category" text,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "audit_events_owner_non_empty" CHECK ("audit_events"."owner_id" <> '')
);
--> statement-breakpoint
CREATE TABLE "operation_ledger" (
	"operation_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_operation_id" text NOT NULL,
	"operation_kind" text NOT NULL,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"response_envelope" "bytea",
	CONSTRAINT "operation_ledger_provider_operation_unique" UNIQUE("owner_id","provider","provider_operation_id"),
	CONSTRAINT "operation_ledger_provider_non_empty" CHECK ("operation_ledger"."provider" <> ''),
	CONSTRAINT "operation_ledger_operation_non_empty" CHECK ("operation_ledger"."provider_operation_id" <> '')
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"source_node_type" text NOT NULL,
	"destination_node_id" text NOT NULL,
	"destination_node_type" text NOT NULL,
	"relation" text NOT NULL,
	"origin" text NOT NULL,
	"evidence" text,
	"confidence" integer,
	"lifecycle" text NOT NULL,
	"privacy" text NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"version" integer NOT NULL,
	CONSTRAINT "edges_relation_valid" CHECK ("edges"."relation" in ('event_in_calendar', 'task_from_source', 'note_about_event', 'commitment_for_person', 'recommendation_for_event', 'preference_for_policy', 'policy_governs_event', 'alert_episode_for_event')),
	CONSTRAINT "edges_relation_endpoints_valid" CHECK (("edges"."relation" = 'event_in_calendar' and "edges"."source_node_type" = 'event' and "edges"."destination_node_type" = 'calendar') or ("edges"."relation" = 'task_from_source' and "edges"."source_node_type" = 'task' and "edges"."destination_node_type" = 'source_artifact') or ("edges"."relation" = 'note_about_event' and "edges"."source_node_type" = 'note' and "edges"."destination_node_type" = 'event') or ("edges"."relation" = 'commitment_for_person' and "edges"."source_node_type" = 'commitment' and "edges"."destination_node_type" = 'person') or ("edges"."relation" = 'recommendation_for_event' and "edges"."source_node_type" = 'recommendation' and "edges"."destination_node_type" = 'event') or ("edges"."relation" = 'preference_for_policy' and "edges"."source_node_type" = 'preference' and "edges"."destination_node_type" = 'policy') or ("edges"."relation" = 'policy_governs_event' and "edges"."source_node_type" = 'policy' and "edges"."destination_node_type" = 'event') or ("edges"."relation" = 'alert_episode_for_event' and "edges"."source_node_type" = 'alert_episode' and "edges"."destination_node_type" = 'event')),
	CONSTRAINT "edges_origin_valid" CHECK ("edges"."origin" in ('provider', 'user', 'system', 'model')),
	CONSTRAINT "edges_lifecycle_valid" CHECK ("edges"."lifecycle" in ('proposed', 'confirmed', 'rejected', 'retracted')),
	CONSTRAINT "edges_privacy_valid" CHECK ("edges"."privacy" in ('planning', 'private', 'restricted')),
	CONSTRAINT "edges_confidence_valid" CHECK ("edges"."confidence" is null or ("edges"."confidence" >= 0 and "edges"."confidence" <= 1000000)),
	CONSTRAINT "edges_validity_valid" CHECK ("edges"."valid_to" is null or ("edges"."valid_from" is not null and "edges"."valid_to" > "edges"."valid_from")),
	CONSTRAINT "edges_version_positive" CHECK ("edges"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"node_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"node_type" text DEFAULT 'event' NOT NULL,
	"provider" text NOT NULL,
	"provider_calendar_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_version" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"busy" boolean NOT NULL,
	"status" text NOT NULL,
	"recurrence_id" text,
	"title_envelope" "bytea",
	"description_envelope" "bytea",
	"attendees_envelope" "bytea",
	"location_envelope" "bytea",
	"meeting_link_envelope" "bytea",
	"protected_key_version" integer,
	CONSTRAINT "events_node_id_pk" PRIMARY KEY("node_id"),
	CONSTRAINT "events_node_owner_unique" UNIQUE("node_id","owner_id"),
	CONSTRAINT "events_provider_identity_unique" UNIQUE("provider","provider_calendar_id","provider_event_id"),
	CONSTRAINT "events_provider_non_empty" CHECK ("events"."provider" <> ''),
	CONSTRAINT "events_calendar_non_empty" CHECK ("events"."provider_calendar_id" <> ''),
	CONSTRAINT "events_provider_event_non_empty" CHECK ("events"."provider_event_id" <> ''),
	CONSTRAINT "events_provider_version_non_empty" CHECK ("events"."provider_version" <> ''),
	CONSTRAINT "events_node_type_event" CHECK ("events"."node_type" = 'event'),
	CONSTRAINT "events_end_after_start" CHECK ("events"."ends_at" > "events"."starts_at"),
	CONSTRAINT "events_status_valid" CHECK ("events"."status" in ('confirmed', 'tentative', 'cancelled')),
	CONSTRAINT "events_protected_key_positive" CHECK ("events"."protected_key_version" is null or "events"."protected_key_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text NOT NULL,
	"owner_id" text NOT NULL,
	"identity_kind" text NOT NULL,
	"provider" text NOT NULL,
	"provider_node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"domain" text NOT NULL,
	"domain_state" text NOT NULL,
	"privacy" text NOT NULL,
	"provenance" text NOT NULL,
	"lifecycle" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"version" integer NOT NULL,
	"model_confidence" integer,
	CONSTRAINT "nodes_id_pk" PRIMARY KEY("id"),
	CONSTRAINT "nodes_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "nodes_id_owner_type_unique" UNIQUE("id","owner_id","node_type"),
	CONSTRAINT "nodes_owner_provider_identity_unique" UNIQUE("owner_id","provider","provider_node_id"),
	CONSTRAINT "nodes_owner_non_empty" CHECK ("nodes"."owner_id" <> ''),
	CONSTRAINT "nodes_provider_non_empty" CHECK ("nodes"."provider" <> ''),
	CONSTRAINT "nodes_provider_node_non_empty" CHECK ("nodes"."provider_node_id" <> ''),
	CONSTRAINT "nodes_identity_kind_valid" CHECK ("nodes"."identity_kind" in ('provider', 'first_party', 'system')),
	CONSTRAINT "nodes_type_valid" CHECK ("nodes"."node_type" in ('event', 'task', 'note', 'commitment', 'recommendation', 'preference', 'policy', 'audit_event', 'person', 'calendar', 'source_artifact', 'alert_episode')),
	CONSTRAINT "nodes_domain_valid" CHECK ("nodes"."domain" in ('school', 'work', 'personal', 'unresolved')),
	CONSTRAINT "nodes_domain_state_valid" CHECK ("nodes"."domain_state" in ('confirmed', 'inferred', 'unresolved') and (("nodes"."domain" = 'unresolved') = ("nodes"."domain_state" = 'unresolved'))),
	CONSTRAINT "nodes_privacy_valid" CHECK ("nodes"."privacy" in ('planning', 'private', 'restricted')),
	CONSTRAINT "nodes_provenance_valid" CHECK ("nodes"."provenance" in ('provider', 'user', 'system', 'model')),
	CONSTRAINT "nodes_lifecycle_valid" CHECK ("nodes"."lifecycle" in ('active', 'deleted', 'purged')),
	CONSTRAINT "nodes_timestamps_valid" CHECK ("nodes"."updated_at" >= "nodes"."created_at" and ("nodes"."valid_to" is null or "nodes"."valid_to" > "nodes"."valid_from")),
	CONSTRAINT "nodes_version_positive" CHECK ("nodes"."version" > 0),
	CONSTRAINT "nodes_inference_confidence_valid" CHECK ((("nodes"."domain_state" = 'inferred') = ("nodes"."model_confidence" is not null)) and ("nodes"."model_confidence" is null or ("nodes"."model_confidence" >= 0 and "nodes"."model_confidence" <= 1000000)))
);
--> statement-breakpoint
CREATE TABLE "recoverable_deletions" (
	"node_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"deleted_at" timestamp with time zone NOT NULL,
	"purge_after" timestamp with time zone NOT NULL,
	"recovery_envelope" "bytea",
	CONSTRAINT "recoverable_deletions_node_id_pk" PRIMARY KEY("node_id"),
	CONSTRAINT "recoverable_deletions_purge_after_deleted" CHECK ("recoverable_deletions"."purge_after" > "recoverable_deletions"."deleted_at")
);
--> statement-breakpoint
CREATE TABLE "sync_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_calendar_id" text NOT NULL,
	"provider_channel_id" text NOT NULL,
	"provider_resource_id" text NOT NULL,
	"verification_token_envelope" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_channels_provider_channel_unique" UNIQUE("owner_id","provider","provider_channel_id"),
	CONSTRAINT "sync_channels_provider_non_empty" CHECK ("sync_channels"."provider" <> ''),
	CONSTRAINT "sync_channels_calendar_non_empty" CHECK ("sync_channels"."provider_calendar_id" <> ''),
	CONSTRAINT "sync_channels_channel_non_empty" CHECK ("sync_channels"."provider_channel_id" <> ''),
	CONSTRAINT "sync_channels_resource_non_empty" CHECK ("sync_channels"."provider_resource_id" <> '')
);
--> statement-breakpoint
CREATE TABLE "sync_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_calendar_id" text NOT NULL,
	"sync_token_envelope" "bytea" NOT NULL,
	"key_version" text NOT NULL,
	"committed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_checkpoints_provider_calendar_unique" UNIQUE("owner_id","provider","provider_calendar_id"),
	CONSTRAINT "sync_checkpoints_provider_non_empty" CHECK ("sync_checkpoints"."provider" <> ''),
	CONSTRAINT "sync_checkpoints_calendar_non_empty" CHECK ("sync_checkpoints"."provider_calendar_id" <> ''),
	CONSTRAINT "sync_checkpoints_key_version_non_empty" CHECK ("sync_checkpoints"."key_version" <> '')
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_node_owner_fk" FOREIGN KEY ("node_id","owner_id") REFERENCES "public"."nodes"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_owner_fk" FOREIGN KEY ("source_node_id","owner_id") REFERENCES "public"."nodes"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_destination_owner_fk" FOREIGN KEY ("destination_node_id","owner_id") REFERENCES "public"."nodes"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_owner_type_fk" FOREIGN KEY ("source_node_id","owner_id","source_node_type") REFERENCES "public"."nodes"("id","owner_id","node_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_destination_owner_type_fk" FOREIGN KEY ("destination_node_id","owner_id","destination_node_type") REFERENCES "public"."nodes"("id","owner_id","node_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_node_owner_fk" FOREIGN KEY ("node_id","owner_id") REFERENCES "public"."nodes"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_node_owner_type_fk" FOREIGN KEY ("node_id","owner_id","node_type") REFERENCES "public"."nodes"("id","owner_id","node_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recoverable_deletions" ADD CONSTRAINT "recoverable_deletions_node_owner_fk" FOREIGN KEY ("node_id","owner_id") REFERENCES "public"."nodes"("id","owner_id") ON DELETE no action ON UPDATE no action;