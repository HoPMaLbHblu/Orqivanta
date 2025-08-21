CREATE TYPE "public"."export_status" AS ENUM('queued', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"requested_by" uuid,
	"status" "export_status" DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"size_bytes" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_exports_org_idx" ON "data_exports" USING btree ("org_id","created_at");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_has_parent" CHECK (num_nonnulls("files"."project_id", "files"."request_id") >= 1);--> statement-breakpoint
ALTER TABLE "data_exports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "data_exports_tenant_isolation" ON "data_exports" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
