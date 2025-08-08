-- Row-level security: every tenant table is visible only inside withTenant(org) or withSystem().
-- The application role does not own these tables, so the policies always apply to it.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on'
$$;
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "teams_tenant_isolation" ON "teams" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "team_members_tenant_isolation" ON "team_members" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "client_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "client_accounts_tenant_isolation" ON "client_accounts" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "projects_tenant_isolation" ON "projects" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "project_members_tenant_isolation" ON "project_members" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "project_statuses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "project_statuses_tenant_isolation" ON "project_statuses" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "milestones_tenant_isolation" ON "milestones" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "project_updates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "project_updates_tenant_isolation" ON "project_updates" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "labels_tenant_isolation" ON "labels" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tasks_tenant_isolation" ON "tasks" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "task_labels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_labels_tenant_isolation" ON "task_labels" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "task_watchers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_watchers_tenant_isolation" ON "task_watchers" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_dependencies_tenant_isolation" ON "task_dependencies" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "checklist_items_tenant_isolation" ON "checklist_items" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "task_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_history_tenant_isolation" ON "task_history" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "collections_tenant_isolation" ON "collections" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "document_versions_tenant_isolation" ON "document_versions" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "files_tenant_isolation" ON "files" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "file_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "file_versions_tenant_isolation" ON "file_versions" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "request_forms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "request_forms_tenant_isolation" ON "request_forms" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "requests_tenant_isolation" ON "requests" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "approvals_tenant_isolation" ON "approvals" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "approval_reviewers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "approval_reviewers_tenant_isolation" ON "approval_reviewers" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comments_tenant_isolation" ON "comments" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comment_reactions_tenant_isolation" ON "comment_reactions" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "activity_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "activity_events_tenant_isolation" ON "activity_events" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notifications_tenant_isolation" ON "notifications" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "realtime_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "realtime_events_tenant_isolation" ON "realtime_events" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "outbox_tenant_isolation" ON "outbox" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "favorites_tenant_isolation" ON "favorites" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "recent_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recent_items_tenant_isolation" ON "recent_items" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "saved_views_tenant_isolation" ON "saved_views" USING (app_bypass_rls() OR org_id = app_current_org()) WITH CHECK (app_bypass_rls() OR org_id = app_current_org());
--> statement-breakpoint
-- Live updates: NOTIFY is transactional, so listeners only hear about committed rows.
CREATE OR REPLACE FUNCTION realtime_events_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('orq_realtime', json_build_object('id', NEW.id, 'org', NEW.org_id)::text);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER realtime_events_notify_trg AFTER INSERT ON realtime_events FOR EACH ROW EXECUTE FUNCTION realtime_events_notify();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION outbox_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('orq_outbox', NEW.id::text);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER outbox_notify_trg AFTER INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION outbox_notify();
--> statement-breakpoint
-- files.request_id is declared here to avoid a circular schema import.
ALTER TABLE "files" ADD CONSTRAINT "files_request_fk" FOREIGN KEY ("org_id", "request_id") REFERENCES "requests" ("org_id", "id") ON DELETE CASCADE;
