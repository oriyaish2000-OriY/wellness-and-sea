-- ============================================================
-- WELLNESS&SEA — Production Database Schema v2
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('host', 'instructor', 'student')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  certification_url TEXT,
  insurance_url TEXT,
  -- Payment & social (instructors fill these; used for direct student payments)
  bit_phone    TEXT,
  paybox_phone TEXT,
  bank_account TEXT,
  specialties  TEXT[],
  instagram    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venues
CREATE TABLE IF NOT EXISTS venues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_address TEXT NOT NULL,
  location_city TEXT NOT NULL DEFAULT 'תל אביב',
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  hourly_price INTEGER NOT NULL CHECK (hourly_price > 0),
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  space_size_sqm INTEGER CHECK (space_size_sqm > 0),
  amenities JSONB NOT NULL DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  bonus_offer TEXT,
  accessibility_info TEXT,
  is_active BOOLEAN DEFAULT FALSE, -- FALSE until host explicitly publishes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability slots (recurring weekly schedule per venue)
CREATE TABLE IF NOT EXISTS availabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  UNIQUE (venue_id, day_of_week, start_time)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE RESTRICT NOT NULL,
  instructor_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price INTEGER NOT NULL CHECK (total_price > 0),
  platform_fee INTEGER NOT NULL DEFAULT 35,
  host_payout INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  class_type TEXT,
  participants_count INTEGER,
  special_requests TEXT,
  tranzila_transaction_id TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  -- Student class fields (set by instructor to open booking to student enrollment)
  open_to_students  BOOLEAN DEFAULT false,
  max_students      INTEGER CHECK (max_students IS NULL OR (max_students >= 1 AND max_students <= 100)),
  price_per_student INTEGER CHECK (price_per_student IS NULL OR price_per_student >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_booking_time CHECK (end_time > start_time)
);

-- Prevent overlapping bookings at DB level
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_overlap
  ON bookings (venue_id, booking_date, start_time)
  WHERE status NOT IN ('cancelled');

-- Student enrollments in instructor-opened classes
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
  -- Uniqueness: one ACTIVE enrollment per student per class.
  -- Cancelled rows are kept for audit trail; student may re-enroll after cancellation.
  -- Enforced by partial unique index below.
);

-- Health declarations (per student per booking)
CREATE TABLE IF NOT EXISTS health_declarations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  declaration_text TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- AI Assistant chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved venues (instructor wishlist / favorites)
CREATE TABLE IF NOT EXISTS saved_venues (
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (instructor_id, venue_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(location_city) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_venues_host ON venues(host_id);
CREATE INDEX IF NOT EXISTS idx_venues_capacity ON venues(capacity) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookings_venue_date ON bookings(venue_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_instructor ON bookings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_availabilities_venue ON availabilities(venue_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);

-- class_enrollments indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique_active
  ON class_enrollments (booking_id, student_id)
  WHERE payment_status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_enrollments_booking   ON class_enrollments (booking_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student   ON class_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_book_status ON class_enrollments (booking_id, payment_status);
-- Open-classes listing
CREATE INDEX IF NOT EXISTS idx_bookings_open_classes
  ON bookings (booking_date, open_to_students)
  WHERE open_to_students = true AND status = 'confirmed';

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS venues_updated_at ON venues;
CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup (email + Google OAuth)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'instructor'),
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Capacity enforcement for class_enrollments
-- Fires on INSERT and on UPDATE that un-cancels a row (prevents TOCTOU overbooking)
CREATE OR REPLACE FUNCTION check_enrollment_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_max     INTEGER;
  v_current INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.payment_status = 'cancelled' AND NEW.payment_status != 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT max_students INTO v_max FROM bookings WHERE id = NEW.booking_id;
  IF v_max IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_current
  FROM class_enrollments
  WHERE booking_id = NEW.booking_id
    AND payment_status != 'cancelled'
    AND id IS DISTINCT FROM NEW.id;

  IF v_current >= v_max THEN
    RAISE EXCEPTION 'ENROLLMENT_FULL'
      USING ERRCODE = 'P0001', HINT = 'השיעור מלא';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_enrollment_capacity ON class_enrollments;
CREATE TRIGGER enforce_enrollment_capacity
  BEFORE INSERT OR UPDATE ON class_enrollments
  FOR EACH ROW EXECUTE FUNCTION check_enrollment_capacity();

-- Public enrollment count (SECURITY DEFINER so unauthenticated pages can call it)
CREATE OR REPLACE FUNCTION get_enrollment_count(p_booking_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
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

REVOKE ALL    ON FUNCTION get_enrollment_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_enrollment_count(UUID) TO anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_venues ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- VENUES: public reads active; hosts see/manage their own (including inactive)
DROP POLICY IF EXISTS "Active venues are viewable by everyone" ON venues;
DROP POLICY IF EXISTS "Hosts can manage their own venues" ON venues;
CREATE POLICY "venues_select" ON venues FOR SELECT
  USING (is_active = true OR auth.uid() = host_id);
CREATE POLICY "venues_insert_host" ON venues FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'host')
  );
CREATE POLICY "venues_update_host" ON venues FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "venues_delete_host" ON venues FOR DELETE USING (auth.uid() = host_id);

-- AVAILABILITIES
DROP POLICY IF EXISTS "Availabilities are viewable by everyone" ON availabilities;
DROP POLICY IF EXISTS "Hosts can manage availabilities" ON availabilities;
CREATE POLICY "availabilities_select_all" ON availabilities FOR SELECT USING (true);
CREATE POLICY "availabilities_manage_host" ON availabilities FOR ALL
  USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));

-- BOOKINGS
DROP POLICY IF EXISTS "Instructors see their bookings" ON bookings;
DROP POLICY IF EXISTS "Hosts see bookings for their venues" ON bookings;
DROP POLICY IF EXISTS "Instructors can create bookings" ON bookings;
DROP POLICY IF EXISTS "Hosts can update booking status" ON bookings;
CREATE POLICY "bookings_select_instructor" ON bookings FOR SELECT
  USING (auth.uid() = instructor_id);
CREATE POLICY "bookings_select_host" ON bookings FOR SELECT
  USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));
CREATE POLICY "bookings_insert_instructor" ON bookings FOR INSERT
  WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'instructor')
  );
CREATE POLICY "bookings_update_instructor" ON bookings FOR UPDATE
  USING (auth.uid() = instructor_id AND status = 'pending');
CREATE POLICY "bookings_update_host" ON bookings FOR UPDATE
  USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));

-- Open/confirmed classes are publicly readable (powers the /classes browse page)
DROP POLICY IF EXISTS "bookings_select_open_public" ON bookings;
CREATE POLICY "bookings_select_open_public" ON bookings
  FOR SELECT USING (
    open_to_students = true AND status = 'confirmed'
  );

-- Enrolled students can read their booked class details (dashboard, pay page)
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

-- CLASS ENROLLMENTS
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments_select_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_select_instructor" ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_insert_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_update_student"    ON class_enrollments;
DROP POLICY IF EXISTS "enrollments_update_instructor" ON class_enrollments;

-- Students see only their own enrollment rows
CREATE POLICY "enrollments_select_student" ON class_enrollments
  FOR SELECT USING (auth.uid() = student_id);

-- Instructors see all enrollments for their bookings (roster)
CREATE POLICY "enrollments_select_instructor" ON class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.instructor_id = auth.uid()
    )
  );

-- Students enroll themselves; cannot enroll in their own class
CREATE POLICY "enrollments_insert_student" ON class_enrollments
  FOR INSERT WITH CHECK (
    auth.uid() = student_id
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.instructor_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND b.open_to_students = true
        AND b.status = 'confirmed'
    )
  );

-- Students can cancel own enrollment or self-report payment (→ 'paid' or 'cancelled' only)
CREATE POLICY "enrollments_update_student" ON class_enrollments
  FOR UPDATE
  USING  (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND payment_status IN ('paid', 'cancelled')
  );

-- Instructors can update enrollment status for their classes (confirm payment, etc.)
CREATE POLICY "enrollments_update_instructor" ON class_enrollments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.instructor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.instructor_id = auth.uid()
    )
  );

-- DELETE: nobody — use payment_status = 'cancelled' instead

-- HEALTH DECLARATIONS
CREATE POLICY "health_decl_access" ON health_declarations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (b.instructor_id = auth.uid()
          OR auth.uid() = (SELECT host_id FROM venues WHERE id = b.venue_id))
    )
  );

-- MESSAGES: users see only their own
CREATE POLICY "messages_own" ON messages FOR ALL USING (auth.uid() = user_id);

-- SAVED VENUES
CREATE POLICY "saved_venues_own" ON saved_venues FOR ALL USING (auth.uid() = instructor_id);

-- ============================================================
-- REVIEWS
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_venue ON reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_reviews_instructor ON reviews(instructor_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_instructor" ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = instructor_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE id = booking_id
        AND instructor_id = auth.uid()
        AND status = 'completed'
    )
  );
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE
  USING (auth.uid() = instructor_id);
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE
  USING (auth.uid() = instructor_id);

-- ============================================================
-- HEALTH DECLARATIONS
-- (table already exists above — adding missing index)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_health_decl_booking ON health_declarations(booking_id);

-- ============================================================
-- STORAGE BUCKETS
-- Run these lines in Supabase SQL Editor → Storage section
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('venue-images', 'venue-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('instructor-docs', 'instructor-docs', false, 10485760, ARRAY['image/jpeg','image/png','application/pdf'])
  ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "venue_images_upload" ON storage.objects;
DROP POLICY IF EXISTS "venue_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "instructor_docs_own" ON storage.objects;

CREATE POLICY "venue_images_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'venue-images' AND auth.role() = 'authenticated');
CREATE POLICY "venue_images_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'venue-images' AND auth.role() = 'authenticated');
CREATE POLICY "venue_images_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'venue-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "venue_images_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'venue-images');
CREATE POLICY "instructor_docs_own" ON storage.objects FOR ALL
  USING (bucket_id = 'instructor-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
