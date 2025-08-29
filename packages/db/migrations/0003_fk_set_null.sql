-- Optional references inside a tenant use composite (org_id, x) keys. A plain ON DELETE SET NULL
-- would also null org_id, so these use PostgreSQL's column list form and clear only the reference.
-- Drizzle cannot express this, so the schema keeps "no action" and this migration owns the rule.

ALTER TABLE "projects" DROP CONSTRAINT "projects_client_fk";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_fk" FOREIGN KEY ("org_id","client_account_id") REFERENCES "client_accounts"("org_id","id") ON DELETE SET NULL ("client_account_id");--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_milestone_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_fk" FOREIGN KEY ("org_id","milestone_id") REFERENCES "milestones"("org_id","id") ON DELETE SET NULL ("milestone_id");--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_collection_fk";--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_collection_fk" FOREIGN KEY ("org_id","collection_id") REFERENCES "collections"("org_id","id") ON DELETE SET NULL ("collection_id");--> statement-breakpoint
ALTER TABLE "approvals" DROP CONSTRAINT "approvals_previous_fk";--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_previous_fk" FOREIGN KEY ("org_id","previous_id") REFERENCES "approvals"("org_id","id") ON DELETE SET NULL ("previous_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_client_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_client_fk" FOREIGN KEY ("org_id","client_account_id") REFERENCES "client_accounts"("org_id","id") ON DELETE SET NULL ("client_account_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_project_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_project_fk" FOREIGN KEY ("org_id","project_id") REFERENCES "projects"("org_id","id") ON DELETE SET NULL ("project_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_form_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_form_fk" FOREIGN KEY ("org_id","form_id") REFERENCES "request_forms"("org_id","id") ON DELETE SET NULL ("form_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_duplicate_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_duplicate_fk" FOREIGN KEY ("org_id","duplicate_of_id") REFERENCES "requests"("org_id","id") ON DELETE SET NULL ("duplicate_of_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_task_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_task_fk" FOREIGN KEY ("org_id","converted_task_id") REFERENCES "tasks"("org_id","id") ON DELETE SET NULL ("converted_task_id");--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_converted_project_fk";--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_converted_project_fk" FOREIGN KEY ("org_id","converted_project_id") REFERENCES "projects"("org_id","id") ON DELETE SET NULL ("converted_project_id");--> statement-breakpoint
-- A task's status is required. Deleting a status moves tasks first; whole-project and
-- whole-organization deletes cascade, so the check waits until the end of the transaction.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_status_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_fk" FOREIGN KEY ("org_id","status_id") REFERENCES "project_statuses"("org_id","id") DEFERRABLE INITIALLY DEFERRED;
