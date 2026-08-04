-- ============================================================
-- WELLNESS&SEA — Grow Marketplace Split Payment Migration
-- Run in Supabase SQL Editor → Dashboard > SQL Editor
-- ============================================================

-- 1. Add grow_merchant_id to profiles
--    Stores the Grow sub-merchant user ID after KYC completion.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grow_merchant_id TEXT;

-- 2. Add grow transaction ID to class_enrollments
--    Mirrors the tranzila_transaction_id field on bookings for space rentals.
ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS grow_transaction_id TEXT;

-- 3. Extend class_enrollments.payment_method to accept 'grow'
--    Drop the old constraint and recreate it with the new allowed value.
ALTER TABLE class_enrollments
  DROP CONSTRAINT IF EXISTS class_enrollments_payment_method_check;

ALTER TABLE class_enrollments
  ADD CONSTRAINT class_enrollments_payment_method_check
  CHECK (
    payment_method IS NULL OR
    payment_method IN ('direct', 'bit', 'paybox', 'cash', 'grow')
  );

-- 4. Index for fast sub-merchant lookup
CREATE INDEX IF NOT EXISTS idx_profiles_grow_merchant_id
  ON profiles (grow_merchant_id)
  WHERE grow_merchant_id IS NOT NULL;

-- ============================================================
-- COMMISSION REFERENCE (documented, not enforced at DB level)
-- ============================================================
-- Flow 1 — Space Rental:
--   instructor pays:  base_price × 1.05
--   host receives:    base_price × 0.95
--   platform earns:   base_price × 0.10
--
-- Flow 2 — Class Booking:
--   student pays:     price_per_student (no markup)
--   instructor gets:  price_per_student × 0.90
--   platform earns:   price_per_student × 0.10
-- ============================================================
