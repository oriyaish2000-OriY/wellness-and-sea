-- ============================================================
-- Migration 005 — Cardcom token storage for commission collection
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Token columns on profiles (for instructors and hosts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cardcom_token              TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_month   INTEGER,
  ADD COLUMN IF NOT EXISTS cardcom_token_card_year    INTEGER,
  ADD COLUMN IF NOT EXISTS cardcom_token_approval     TEXT,
  ADD COLUMN IF NOT EXISTS cardcom_token_lp_id        TEXT;   -- pending registration LowProfileId

-- Commission tracking on bookings (space rental)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_charged_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_tx_id          BIGINT;

-- Commission tracking on class_enrollments
ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS commission_charged_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_tx_id          BIGINT;

-- Index for token registration webhook lookup
CREATE INDEX IF NOT EXISTS idx_profiles_cardcom_token_lp
  ON profiles (cardcom_token_lp_id)
  WHERE cardcom_token_lp_id IS NOT NULL;
