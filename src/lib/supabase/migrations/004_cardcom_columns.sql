-- ============================================================
-- Migration 004 — Cardcom payment columns
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Cardcom LowProfile columns for space-rental bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cardcom_low_profile_id  TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_transaction_id   BIGINT,
  ADD COLUMN IF NOT EXISTS cardcom_document_type    TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_document_number  BIGINT,
  ADD COLUMN IF NOT EXISTS cardcom_response_code    TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_description      TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_cardcom_lp
  ON bookings (cardcom_low_profile_id)
  WHERE cardcom_low_profile_id IS NOT NULL;

-- Cardcom LowProfile columns for class-booking enrollments
ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS cardcom_low_profile_id  TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_transaction_id   BIGINT,
  ADD COLUMN IF NOT EXISTS cardcom_document_type    TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_document_number  BIGINT,
  ADD COLUMN IF NOT EXISTS cardcom_response_code    TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_description      TEXT;

CREATE INDEX IF NOT EXISTS idx_enrollments_cardcom_lp
  ON class_enrollments (cardcom_low_profile_id)
  WHERE cardcom_low_profile_id IS NOT NULL;
