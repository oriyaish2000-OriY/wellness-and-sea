-- ============================================================
-- Migration 001 — Add new profile fields & student role
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Allow 'student' role in profiles table
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('host', 'instructor', 'student'));

-- 2. Add payment & public-profile columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bit_phone      TEXT,
  ADD COLUMN IF NOT EXISTS paybox_phone   TEXT,
  ADD COLUMN IF NOT EXISTS bank_account   TEXT,
  ADD COLUMN IF NOT EXISTS specialties    TEXT[],
  ADD COLUMN IF NOT EXISTS instagram      TEXT;

-- 3. Update handle_new_user trigger to support 'student' role
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      'instructor'   -- default fallback
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Make confirmed bookings visible publicly (for /instructors/[id] upcoming classes)
--    Students (unauthenticated) need to see instructor's confirmed bookings
DROP POLICY IF EXISTS "bookings_select_public_confirmed" ON bookings;
CREATE POLICY "bookings_select_public_confirmed" ON bookings
  FOR SELECT USING (status = 'confirmed');

-- Done. Verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position;
