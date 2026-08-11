-- Migration 007: Distributed rate limiting table + platform payment ID columns
-- Run: 2026-08-11 (STATUS 201 confirmed on production Supabase)

-- Rate limiting table for distributed (cross-instance) sliding window limits
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  key          TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time
  ON rate_limit_attempts (key, attempted_at);

-- RLS: no direct client access — service role only
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Store SUMIT platform commission payment ID alongside vendor payment ID
-- Required for full multivendor refunds (each leg needs its own credentials)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS platform_payment_id TEXT;

ALTER TABLE class_enrollments
  ADD COLUMN IF NOT EXISTS platform_payment_id TEXT;
