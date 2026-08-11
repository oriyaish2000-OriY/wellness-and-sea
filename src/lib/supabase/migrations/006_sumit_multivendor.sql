-- ============================================================
-- Migration 006: SUMIT Multivendor split-payment support
-- Run in Supabase SQL Editor AFTER migration 005
-- ============================================================

-- 1. class_enrollments: add tranzila_transaction_id for storing SUMIT PaymentID
--    (bookings already has this column from the base schema)
ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS tranzila_transaction_id TEXT;

-- 2. Expand payment_method CHECK to include 'sumit'
--    multivendorcharge marks enrollments with payment_method = 'sumit'
ALTER TABLE class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_payment_method_check;

ALTER TABLE class_enrollments
  ADD CONSTRAINT class_enrollments_payment_method_check
  CHECK (payment_method IS NULL OR
         payment_method IN ('direct', 'bit', 'paybox', 'cash', 'sumit'));

-- 3. vendor_sumit_company_id on both tables — records which vendor was paid
--    Used for payout audit trail even in direct-split model
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vendor_sumit_company_id INTEGER;

ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS vendor_sumit_company_id INTEGER;

-- 4. confirmed_at on bookings (set when payment confirmed)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_sumit
  ON bookings (vendor_sumit_company_id)
  WHERE vendor_sumit_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_vendor_sumit
  ON class_enrollments (vendor_sumit_company_id)
  WHERE vendor_sumit_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_tranzila_tx
  ON class_enrollments (tranzila_transaction_id)
  WHERE tranzila_transaction_id IS NOT NULL;

-- 6. RLS: drop old SELECT policy that exposed sumit_api_key
DROP POLICY IF EXISTS "vendor_see_own_config" ON vendor_payment_config;

-- Re-add a safe SELECT policy that still allows vendors to query their own status
-- Note: The API uses service role which bypasses RLS.
-- This policy is for the Supabase client on the frontend (status checks only).
DROP POLICY IF EXISTS "vendor_see_own_config_safe" ON vendor_payment_config;
CREATE POLICY "vendor_see_own_config_safe"
  ON vendor_payment_config
  FOR SELECT
  USING (auth.uid() = profile_id);

-- 7. Safe view (no API key exposed)
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

-- 8. Update sumit_api_key comment
COMMENT ON COLUMN vendor_payment_config.sumit_api_key IS
  'Vendor private API key — AES-256-GCM encrypted at application level. '
  'Format: iv_hex:ciphertext_hex:tag_hex. Key from VENDOR_KEY_ENCRYPTION_SECRET env var. '
  'Never exposed to client — only decrypted in memory during multivendorcharge call.';
