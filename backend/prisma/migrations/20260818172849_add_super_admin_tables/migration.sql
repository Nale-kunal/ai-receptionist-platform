-- ---------------------------------------------------------------------------
-- Migration: add_super_admin_tables
-- Created: 2026-08-18
--
-- Creates the three tables that back the Platform Super Admin auth boundary:
--   super_admins      — admin accounts (separate from clinic Users)
--   admin_sessions    — refresh-token sessions with rotation
--   admin_audit_logs  — immutable audit trail for all admin actions
--
-- SAFE: No existing tables are modified or dropped.
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "super_admins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "previous_refresh_token_hash" TEXT,
    "rotated_at" TIMESTAMP(3),
    "user_agent" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID,
    "tenant_id" UUID,
    "clinic_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "metadata" JSONB DEFAULT '{}',
    "ip_address" TEXT,
    "request_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");
CREATE INDEX "super_admins_email_idx" ON "super_admins"("email");
CREATE INDEX "super_admins_is_active_idx" ON "super_admins"("is_active");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_status_idx" ON "admin_sessions"("admin_id", "status");
CREATE INDEX "admin_sessions_status_idx" ON "admin_sessions"("status");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");
CREATE INDEX "admin_audit_logs_tenant_id_idx" ON "admin_audit_logs"("tenant_id");
CREATE INDEX "admin_audit_logs_clinic_id_idx" ON "admin_audit_logs"("clinic_id");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");
CREATE INDEX "admin_audit_logs_occurred_at_idx" ON "admin_audit_logs"("occurred_at");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "super_admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
