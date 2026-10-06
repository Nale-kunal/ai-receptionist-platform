-- ---------------------------------------------------------------------------
-- Migration: whatsapp_cloud_api_completion
-- Created: 2026-09-20
--
-- Updates WhatsAppIntegration:
--   1. Makes webhook_verify_token nullable (Option A: platform webhook verification uses WHATSAPP_WEBHOOK_VERIFY_TOKEN env var)
--   2. Adds waba_subscribed boolean flag (default false)
--   3. Adds UNIQUE constraint on phone_number_id
--   4. Adds index on waba_id
--
-- SAFE: Non-destructive migration. Preserves all existing clinic and integration records.
-- ---------------------------------------------------------------------------

-- AlterTable: make webhook_verify_token optional
ALTER TABLE "whatsapp_integrations" ALTER COLUMN "webhook_verify_token" DROP NOT NULL;

-- AlterTable: add waba_subscribed
ALTER TABLE "whatsapp_integrations" ADD COLUMN IF NOT EXISTS "waba_subscribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: unique constraint on phone_number_id
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_integrations_phone_number_id_key" ON "whatsapp_integrations"("phone_number_id");

-- CreateIndex: index on waba_id
CREATE INDEX IF NOT EXISTS "whatsapp_integrations_waba_id_idx" ON "whatsapp_integrations"("waba_id");
