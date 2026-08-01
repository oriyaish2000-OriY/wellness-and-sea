-- ============================================================
-- WELLNESS&SEA — Migration 003: class_enrollments
-- Run in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to re-run after partial failures
-- ============================================================

-- ============================================================
-- 1. PROFILES — add student role + missing payment/social columns
-- ============================================================

-- Drop stale role constraint and re-create with student support
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('host', 'instructor', 'student'));

-- Payment & social columns (all nullable, opt-in)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bit_phone    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paybox_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialties  TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram    TEXT;

-- ============================================================
-- 2. BOOKINGS — add student-class columns
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS open_to_students  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_students      INTEGER
    CHECK (max_students IS NULL OR (max_students >= 1 AND max_students <= 100)),
  ADD COLUMN IF NOT EXISTS price_per_student INTEGER
    CHECK (price_per_student IS NULL OR price_per_student >= 0);

-- Index for the public /classes listing (open + confirmed + future)
CREATE INDEX IF NOT EXISTS idx_bookings_open_classes
  ON bookings (booking_date, open_to_students)
  WHERE open_to_students = true AND status = 'confirmed';

-- ============================================================
-- 3. BOOKINGS RLS — allow public reads for open classes
--    (needed so anonymous users and students can see /classes)
-- ============================================================

-- Open classes are public (like a public event listing)
DROP POLICY IF EXISTS "bookings_select_open_public" ON bookings;
CREATE POLICY "bookings_select_open_public" ON bookings
  FOR SELECT USING (
    open_to_students = true
    AND status = 'confirmed'
  );

-- Enrolled students can read the booking details for classes they joined
-- (needed for student-dashboard and pay page after enrollment)
DROP POLICY IF EXISTS "bookings_select_enrolled_student" ON bookings;
CREATE POLICY "bookings_select_enrolled_student" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_enrollments ce
      WHERE ce.booking_id = id
        AND ce.student_id = auth.uid()
        AND ce.payment_status != 'cancelled'
    )
  );

-- ============================================================
-- 4. CLASS_ENROLLMENTS — table
-- ============================================================

CREATE TABLE IF NOT EXISTS class_enrollments (
  id             UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id     UUID        REFERENCES bookings(id) ON DELETE CASCADE  NOT NULL,
  student_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE  NOT NULL,
  payment_status TEXT        NOT NULL DEFAULT 'pending_direct'
    CHECK (payment_status IN ('pending_direct', 'paid', 'cancelled')),
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('direct', 'bit', 'paybox', 'cash')),
  amount_paid    INTEGER     NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One ACTIVE enrollment per student per class.
-- Cancelled rows are kept for audit; a student may re-enroll after cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique_active
  ON class_enrollments (booking_id, student_id)
  WHERE payment_status != 'cancelled';

-- Supporting indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_booking  ON class_enrollments (booking_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student  ON class_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_book_status ON class_enrollments (booking_id, payment_status);

-- ============================================================
-- 5. CAPACITY ENFORCEMENT TRIGGER
--    Fires on INSERT and on UPDATE that un-cancels a row.
--    Prevents TOCTOU race-condition overbooking atomically.
-- ============================================================

CREATE OR REPLACE FUNCTION check_enrollment_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_max     INTEGER;
  v_current INTEGER;
BEGIN
  -- Only enforce when a row transitions from absent/cancelled → active
  IF TG_OP = 'UPDATE' AND NOT (OLD.payment_status = 'cancelled' AND NEW.payment_status != 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT max_students INTO v_max
  FROM bookings WHERE id = NEW.booking_id;

  -- No limit configured → allow
  IF v_max IS NULL THEN RETURN NEW; END IF;

  -- Count currently active (non-cancelled) enrollments, excluding current row on UPDATE
  SELECT COUNT(*) INTO v_current
  FROM class_enrollments
  WHERE booking_id = NEW.booking_id
    AND payment_status != 'cancelled'
    AND id IS DISTINCT FROM NEW.id;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'ENROLLMENT_FULL'
      USING ERRCODE = 'P0001',
            HINT    = 'השיעור מלא';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_enrollment_capacity ON class_enrollments;
CREATE TRIGGER enforce_enrollment_capacity
  BEFORE INSERT OR UPDATE ON class_enrollments
  FOR EACH ROW EXECUTE FUNCTION check_enrollment_capacity();

-- ============================================================
-- 6. SECURITY DEFINER — public enrollment count
--    Called by public /classes pages (no user session).
--    Only counts for confirmed + open classes → no data leak.
-- ============================================================

CREATE OR REPLACE FUNCTION get_enrollment_count(p_booking_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM class_enrollments ce
  WHERE ce.booking_id = p_booking_id
    AND ce.payment_status != 'cancelled'
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = p_booking_id
        AND b.open_to_students = true
        AND b.status = 'confirmed'
    );
$$;

-- Explicit grants (SECURITY DEFINER functions execute as the defining role,
-- but we still need EXECUTE permission for callers)
REVOKE ALL   ON FUNCTION get_enrollment_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_enrollment_count(UUID) TO anon, authenticated;

-- ============================================================
-- 7. CLASS_ENROLLMENTS RLS
-- ============================================================

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop any previously created policies to avoid duplicates
DROP POLICY IF EXISTS "enrollments_select_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_select_instructor" ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_insert_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_update_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_update_instructor" ON class_enrollments;

-- SELECT — student: own rows only (no PII leak across students)
CREATE POLICY "enrollments_select_student" ON class_enrollments
  FOR SELECT USING (auth.uid() = student_id);

-- SELECT — instructor: all enrollments for their bookings (roster view)
CREATE POLICY "enrollments_select_instructor" ON class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.instructor_id = auth.uid()
    )
  );

-- INSERT — student:
--   • must be enrolling themselves               (student_id = auth.uid())
--   • cannot enroll in a class they instruct     (NOT instructor of this booking)
--   • class must be open + confirmed             (status/open check)
CREATE POLICY "enrollments_insert_student" ON class_enrollments
  FOR INSERT WITH CHECK (
    auth.uid() = student_id
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.instructor_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.open_to_students = true
        AND b.status = 'confirmed'
    )
  );

-- UPDATE — student: can cancel own enrollment OR self-report payment sent.
--   WITH CHECK restricts the NEW payment_status to only 'paid' or 'cancelled'.
--   Students can never set their status back to 'pending_direct' on their own
--   (would bypass capacity trigger if un-cancelling).
CREATE POLICY "enrollments_update_student" ON class_enrollments
  FOR UPDATE
  USING  (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND payment_status IN ('paid', 'cancelled')
  );

-- UPDATE — instructor: can mark any enrollment for their classes as paid/any status.
--   The capacity trigger still fires and prevents over-enrollment if un-cancelling.
CREATE POLICY "enrollments_update_instructor" ON class_enrollments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.instructor_id = auth.uid()
    )
  );

-- DELETE — nobody. Cancellation is done via UPDATE payment_status = 'cancelled'.
-- No DELETE policy = DELETE denied for anon and authenticated alike.

-- ============================================================
-- 8. VERIFY — quick sanity checks (returns empty = good)
-- ============================================================

-- Should return 0 rows (no stale duplicates)
DO $$
BEGIN
  IF EXISTS (
    SELECT booking_id, student_id, COUNT(*)
    FROM class_enrollments
    WHERE payment_status != 'cancelled'
    GROUP BY booking_id, student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'Duplicate active enrollments found — check data integrity';
  END IF;
END $$;
