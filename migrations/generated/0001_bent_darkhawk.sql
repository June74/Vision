CREATE TABLE "event_sync_payloads" (
	"node_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"protected_payload_envelope" "bytea" NOT NULL,
	"protected_key_version" integer NOT NULL,
	CONSTRAINT "event_sync_payloads_node_id_pk" PRIMARY KEY("node_id"),
	CONSTRAINT "event_sync_payloads_key_version_positive" CHECK ("event_sync_payloads"."protected_key_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_calendar_id" text NOT NULL,
	"reason" text NOT NULL,
	"page_count" integer NOT NULL,
	"staged_count" integer NOT NULL,
	"upserted_count" integer NOT NULL,
	"deleted_count" integer NOT NULL,
	"unchanged_count" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"checkpoint_version" integer NOT NULL,
	CONSTRAINT "sync_runs_owner_non_empty" CHECK ("sync_runs"."owner_id" <> ''),
	CONSTRAINT "sync_runs_provider_non_empty" CHECK ("sync_runs"."provider" <> ''),
	CONSTRAINT "sync_runs_calendar_non_empty" CHECK ("sync_runs"."provider_calendar_id" <> ''),
	CONSTRAINT "sync_runs_reason_valid" CHECK ("sync_runs"."reason" in ('initial', 'manual', 'push', 'rebuild', 'repair')),
	CONSTRAINT "sync_runs_page_count_positive" CHECK ("sync_runs"."page_count" > 0),
	CONSTRAINT "sync_runs_staged_count_non_negative" CHECK ("sync_runs"."staged_count" >= 0),
	CONSTRAINT "sync_runs_upserted_count_non_negative" CHECK ("sync_runs"."upserted_count" >= 0),
	CONSTRAINT "sync_runs_deleted_count_non_negative" CHECK ("sync_runs"."deleted_count" >= 0),
	CONSTRAINT "sync_runs_unchanged_count_non_negative" CHECK ("sync_runs"."unchanged_count" >= 0),
	CONSTRAINT "sync_runs_completed_after_started" CHECK ("sync_runs"."completed_at" >= "sync_runs"."started_at"),
	CONSTRAINT "sync_runs_checkpoint_version_positive" CHECK ("sync_runs"."checkpoint_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "sync_checkpoints" DROP CONSTRAINT "sync_checkpoints_key_version_non_empty";--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ALTER COLUMN "sync_token_envelope" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ALTER COLUMN "key_version" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ALTER COLUMN "key_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD COLUMN "last_error_category" text;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "event_sync_payloads" ADD CONSTRAINT "event_sync_payloads_event_owner_fk" FOREIGN KEY ("node_id","owner_id") REFERENCES "public"."events"("node_id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_key_version_positive" CHECK ("sync_checkpoints"."key_version" is null or "sync_checkpoints"."key_version" > 0);--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_version_non_negative" CHECK ("sync_checkpoints"."version" >= 0);--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_status_valid" CHECK ("sync_checkpoints"."status" in ('pending', 'connected', 'disconnected', 'action_required', 'rebuild_required', 'retry_scheduled'));--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_error_category_valid" CHECK ("sync_checkpoints"."last_error_category" is null or "sync_checkpoints"."last_error_category" in ('authorization', 'concurrency', 'database', 'provider', 'schema', 'sync_token_invalid', 'transient'));--> statement-breakpoint
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_token_version_consistent" CHECK (("sync_checkpoints"."version" = 0 and "sync_checkpoints"."sync_token_envelope" is null and "sync_checkpoints"."key_version" is null) or ("sync_checkpoints"."version" > 0 and "sync_checkpoints"."sync_token_envelope" is not null and "sync_checkpoints"."key_version" is not null and "sync_checkpoints"."key_version" > 0));