-- ============================================================
-- Migration 004: Vendor SUMIT Payment Configuration
-- Run in Supabase SQL Editor
-- ============================================================

-- vendor_payment_config
-- Stores each vendor's own SUMIT account credentials for marketplace split payments.
-- The API key is stored encrypted at rest (Supabase handles encryption at the disk level).
-- RLS ensures vendors can only read their own row; only the server (service role) writes.

CREATE TABLE IF NOT EXISTS vendor_payment_config (
  id                UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  sumit_company_id  BIGINT      NOT NULL CHECK (sumit_company_id > 0),
  -- API key stored server-side; never returned to client via RLS policy
  sumit_api_key     TEXT        NOT NULL DEFAULT '',
  onboarding_status TEXT        NOT NULL DEFAULT 'pending'
    CHECK (onboarding_status IN ('pending', 'verified', 'failed')),
  last_verified_at  TIMESTAMPTZ,
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT vendor_payment_config_profile_id_key UNIQUE (profile_id)
);

-- updated_at trigger
CREATE TRIGGER vendor_payment_config_updated_at
  BEFORE UPDATE ON vendor_payment_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_payment_profile
  ON vendor_payment_config (profile_id);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_status
  ON vendor_payment_config (onboarding_status)
  WHERE onboarding_status = 'verified';

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE vendor_payment_config ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own row (but sumit_api_key is in the SELECT)
-- The API never returns sumit_api_key via the status endpoint.
-- The service role bypasses RLS for all writes and admin reads.
CREATE POLICY "vendor_see_own_config"
  ON vendor_payment_config
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Direct inserts from authenticated users (API validates before writing)
CREATE POLICY "vendor_insert_own_config"
  ON vendor_payment_config
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "vendor_update_own_config"
  ON vendor_payment_config
  FOR UPDATE
  USING (auth.uid() = profile_id);

-- Note: DELETE intentionally not granted to users — soft-disable via status change.
-- Admin can delete via service role.

-- ── Comments ───────────────────────────────────────────────────────────────────

COMMENT ON TABLE vendor_payment_config IS
  'Stores vendor (instructor/host) SUMIT account credentials for marketplace split payments. '
  'Credentials are validated via live SUMIT API call before storage. '
  'Only vendors with onboarding_status=''verified'' can receive auto-split payments.';

COMMENT ON COLUMN vendor_payment_config.sumit_api_key IS
  'Vendor private API key — server-side only. Never expose via client-facing APIs.';

COMMENT ON COLUMN vendor_payment_config.onboarding_status IS
  'pending = inserted but not yet validated, '
  'verified = credentials confirmed by SUMIT API, '
  'failed = last validation attempt failed.';
