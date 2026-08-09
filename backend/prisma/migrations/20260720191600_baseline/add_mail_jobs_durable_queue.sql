-- Migration: Add mail_jobs durable queue table
-- Purpose: Replace the in-memory MailJob queue with a crash-safe, idempotent,
--          distributed-worker-safe persistent queue table.
--
-- At-most-once delivery guarantees:
--   1. idempotency_key UNIQUE constraint — duplicate enqueue is a no-op
--   2. FOR UPDATE SKIP LOCKED enables atomic single-worker claiming
--   3. status='delivered' is a terminal state enforced at the application layer
--   4. Lease fields (worker_id, lease_id, lease_expires_at) prevent ghost processing

CREATE TABLE IF NOT EXISTS "mail_jobs" (
    "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key"        TEXT        NOT NULL,   -- SHA-256(tenantId:type:recipient:subject)
    "tenant_id"              UUID,
    "clinic_id"              UUID,
    "notification_id"        UUID,                   -- optional FK to notifications table
    "recipient"              TEXT        NOT NULL,
    "from_address"           TEXT,
    "type"                   TEXT        NOT NULL,   -- invitation | password_reset | email_verification | notification
    "subject"                TEXT        NOT NULL,
    "html_body"              TEXT        NOT NULL,
    "text_body"              TEXT        NOT NULL,
    -- State machine: queued → processing → delivered (terminal)
    --                queued → processing → failed → queued (retry, attempts < max_attempts)
    --                queued → processing → failed (terminal, attempts >= max_attempts)
    "status"                 TEXT        NOT NULL DEFAULT 'queued',
    "attempts"               INTEGER     NOT NULL DEFAULT 0,
    "max_attempts"           INTEGER     NOT NULL DEFAULT 3,
    -- Lease-based atomic claiming
    "worker_id"              TEXT,
    "lease_id"               TEXT,
    "lease_expires_at"       TIMESTAMPTZ,
    -- Provider delivery proof
    "provider_name"          TEXT,
    "provider_message_id"    TEXT,
    "provider_response"      JSONB       DEFAULT '{}',
    -- Scheduling
    "scheduled_at"           TIMESTAMPTZ,
    "next_attempt_at"        TIMESTAMPTZ,
    "last_attempt_at"        TIMESTAMPTZ,
    -- Lifecycle
    "processing_started_at"  TIMESTAMPTZ,
    "processing_completed_at" TIMESTAMPTZ,
    "delivered_at"           TIMESTAMPTZ,
    "failed_at"              TIMESTAMPTZ,
    -- Error tracking
    "failure_reason"         TEXT,
    -- Distributed tracing
    "correlation_id"         TEXT,
    -- Arbitrary non-sensitive metadata
    "metadata"               JSONB       DEFAULT '{}',
    "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "mail_jobs_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "mail_jobs_idempotency_key" UNIQUE      ("idempotency_key")
);

-- Worker poll index (picks next claimable job)
CREATE INDEX IF NOT EXISTS "mail_jobs_status_scheduled_next_created_idx"
    ON "mail_jobs" ("status", "scheduled_at", "next_attempt_at", "created_at");

-- Stale lease recovery index
CREATE INDEX IF NOT EXISTS "mail_jobs_status_lease_expires_idx"
    ON "mail_jobs" ("status", "lease_expires_at");

-- Tenant scoped queries
CREATE INDEX IF NOT EXISTS "mail_jobs_tenant_status_idx"
    ON "mail_jobs" ("tenant_id", "status");

-- Recipient type status (outbox dedup queries)
CREATE INDEX IF NOT EXISTS "mail_jobs_recipient_type_status_idx"
    ON "mail_jobs" ("recipient", "type", "status");

-- Correlation ID tracing
CREATE INDEX IF NOT EXISTS "mail_jobs_correlation_id_idx"
    ON "mail_jobs" ("correlation_id");

-- Trigger to auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_mail_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mail_jobs_updated_at_trigger ON "mail_jobs";
CREATE TRIGGER mail_jobs_updated_at_trigger
    BEFORE UPDATE ON "mail_jobs"
    FOR EACH ROW EXECUTE FUNCTION update_mail_jobs_updated_at();

-- Status check constraint: only valid state machine values are permitted
ALTER TABLE "mail_jobs"
    DROP CONSTRAINT IF EXISTS "mail_jobs_status_check";
ALTER TABLE "mail_jobs"
    ADD CONSTRAINT "mail_jobs_status_check"
    CHECK ("status" IN ('queued', 'processing', 'delivered', 'failed'));

-- Add a comment documenting the at-most-once guarantee
COMMENT ON TABLE "mail_jobs" IS
    'Durable mail delivery queue. At-most-once delivery enforced by idempotency_key UNIQUE constraint, '
    'FOR UPDATE SKIP LOCKED worker claiming, and terminal status=delivered guard. '
    'Never replay delivered jobs. Created by migration: add_mail_jobs_durable_queue.';
