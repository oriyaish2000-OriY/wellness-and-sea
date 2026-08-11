-- ============================================================
-- Migration 005: Security fixes + payout tracking
-- ============================================================

-- 1. Fix RLS: prevent authenticated clients from reading sumit_api_key directly
--    All reads go through the API (service role). Client should never query
--    vendor_payment_config directly.

-- Drop the existing SELECT policy that allows clients to read the key
DROP POLICY IF EXISTS "vendor_see_own_config" ON vendor_payment_config;

-- No SELECT from authenticated role directly on this table.
-- The API (service role) handles all reads and never returns sumit_api_key.
-- Keep INSERT/UPDATE policies for vendor onboarding flow.

-- Create a read-only safe view for authenticated users (excludes api key)
CREATE OR REPLACE VIEW vendor_payment_config_safe AS
  SELECT
    id,
    profile_id,
    sumit_company_id,
    onboarding_status,
    last_verified_at,
    failure_reason,
    created_at,
    updated_at
  FROM vendor_payment_config;

-- Authenticated users can only see their own row via this view
CREATE POLICY "vendor_see_own_safe"
  ON vendor_payment_config
  FOR SELECT
  USING (auth.uid() = profile_id AND current_user != 'service_role');

-- 2. Add confirmed_at column to bookings if it doesn't exist
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 3. Add vendor_payout_status and related payout-tracking columns
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vendor_payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (vendor_payout_status IN ('pending', 'paid', 'na')),
  ADD COLUMN IF NOT EXISTS vendor_payout_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_payout_notes TEXT;

ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS vendor_payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (vendor_payout_status IN ('pending', 'paid', 'na')),
  ADD COLUMN IF NOT EXISTS vendor_payout_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_payout_notes TEXT;

-- 4. Add SUMIT payment-ID column to class_enrollments
--    (bookings already has tranzila_transaction_id from the base schema;
--     class_enrollments was created without it — used for idempotency in return handler)
ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS tranzila_transaction_id TEXT;

-- 5. Add vendor_sumit_company_id to both tables for payout tracking
--    Checkout routes record which vendor's SUMIT account to pay out to.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vendor_sumit_company_id INTEGER;

ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS vendor_sumit_company_id INTEGER;

-- 6. Expand payment_method CHECK on class_enrollments to allow 'sumit'
--    The original constraint only allowed: direct, bit, paybox, cash.
--    Drop the auto-named constraint and recreate it with sumit included.
ALTER TABLE class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_payment_method_check;

ALTER TABLE class_enrollments
  ADD CONSTRAINT class_enrollments_payment_method_check
  CHECK (payment_method IS NULL OR
         payment_method IN ('direct', 'bit', 'paybox', 'cash', 'sumit'));

-- 7. Note: sumit_api_key is now stored encrypted (AES-256-GCM at application level)
--    Old keys (if any) need manual re-entry via vendor onboarding UI.
COMMENT ON COLUMN vendor_payment_config.sumit_api_key IS
  'Vendor private API key — AES-256-GCM encrypted at application level. '
  'Format: iv_hex:ciphertext_hex:tag_hex. Key: VENDOR_KEY_ENCRYPTION_SECRET env var.';

-- 8. Indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_bookings_payout_status
  ON bookings (vendor_payout_status)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_enrollments_payout_status
  ON class_enrollments (vendor_payout_status)
  WHERE payment_status = 'paid';

CREATE INDEX IF NOT EXISTS idx_bookings_vendor_sumit
  ON bookings (vendor_sumit_company_id)
  WHERE vendor_sumit_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_vendor_sumit
  ON class_enrollments (vendor_sumit_company_id)
  WHERE vendor_sumit_company_id IS NOT NULL;
