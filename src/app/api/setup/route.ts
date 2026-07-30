import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export const runtime = 'nodejs'
export const maxDuration = 60

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('host', 'instructor', 'student')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  certification_url TEXT,
  insurance_url TEXT,
  bit_phone TEXT,
  paybox_phone TEXT,
  bank_account TEXT,
  specialties TEXT[],
  instagram TEXT,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_address TEXT NOT NULL,
  location_city TEXT NOT NULL DEFAULT '',
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  hourly_price INTEGER NOT NULL CHECK (hourly_price > 0),
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  space_size_sqm INTEGER CHECK (space_size_sqm > 0),
  amenities JSONB NOT NULL DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  bonus_offer TEXT,
  accessibility_info TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  UNIQUE (venue_id, day_of_week, start_time)
);

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  class_type TEXT,
  participants_count INTEGER,
  special_requests TEXT,
  tranzila_transaction_id TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_booking_time CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_overlap ON bookings (venue_id, booking_date, start_time) WHERE status NOT IN ('cancelled');

CREATE TABLE IF NOT EXISTS health_declarations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL,
  declaration_text TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  session_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_venues (
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (instructor_id, venue_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instructor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(location_city) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_venues_host ON venues(host_id);
CREATE INDEX IF NOT EXISTS idx_venues_capacity ON venues(capacity) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookings_venue_date ON bookings(venue_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_instructor ON bookings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_availabilities_venue ON availabilities(venue_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_venue ON reviews(venue_id);
CREATE INDEX IF NOT EXISTS idx_reviews_instructor ON reviews(instructor_id);
CREATE INDEX IF NOT EXISTS idx_health_decl_booking ON health_declarations(booking_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_booking ON class_enrollments(booking_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS venues_updated_at ON venues;
CREATE TRIGGER venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role','instructor'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
  CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
  DROP POLICY IF EXISTS "venues_select" ON venues;
  DROP POLICY IF EXISTS "venues_insert_host" ON venues;
  DROP POLICY IF EXISTS "venues_update_host" ON venues;
  DROP POLICY IF EXISTS "venues_delete_host" ON venues;
  CREATE POLICY "venues_select" ON venues FOR SELECT USING (is_active = true OR auth.uid() = host_id);
  CREATE POLICY "venues_insert_host" ON venues FOR INSERT WITH CHECK (auth.uid() = host_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'host'));
  CREATE POLICY "venues_update_host" ON venues FOR UPDATE USING (auth.uid() = host_id);
  CREATE POLICY "venues_delete_host" ON venues FOR DELETE USING (auth.uid() = host_id);
  DROP POLICY IF EXISTS "availabilities_select_all" ON availabilities;
  DROP POLICY IF EXISTS "availabilities_manage_host" ON availabilities;
  CREATE POLICY "availabilities_select_all" ON availabilities FOR SELECT USING (true);
  CREATE POLICY "availabilities_manage_host" ON availabilities FOR ALL USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));
  DROP POLICY IF EXISTS "bookings_select_instructor" ON bookings;
  DROP POLICY IF EXISTS "bookings_select_host" ON bookings;
  DROP POLICY IF EXISTS "bookings_select_public_confirmed" ON bookings;
  DROP POLICY IF EXISTS "bookings_insert_instructor" ON bookings;
  DROP POLICY IF EXISTS "bookings_update_instructor" ON bookings;
  DROP POLICY IF EXISTS "bookings_update_host" ON bookings;
  CREATE POLICY "bookings_select_instructor" ON bookings FOR SELECT USING (auth.uid() = instructor_id);
  CREATE POLICY "bookings_select_host" ON bookings FOR SELECT USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));
  CREATE POLICY "bookings_select_public_confirmed" ON bookings FOR SELECT USING (status = 'confirmed');
  CREATE POLICY "bookings_insert_instructor" ON bookings FOR INSERT WITH CHECK (auth.uid() = instructor_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'instructor'));
  CREATE POLICY "bookings_update_instructor" ON bookings FOR UPDATE USING (auth.uid() = instructor_id AND status = 'pending');
  CREATE POLICY "bookings_update_host" ON bookings FOR UPDATE USING (auth.uid() = (SELECT host_id FROM venues WHERE id = venue_id));
  DROP POLICY IF EXISTS "health_decl_access" ON health_declarations;
  CREATE POLICY "health_decl_access" ON health_declarations FOR ALL USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.instructor_id = auth.uid() OR auth.uid() = (SELECT host_id FROM venues WHERE id = b.venue_id))));
  DROP POLICY IF EXISTS "messages_own" ON messages;
  CREATE POLICY "messages_own" ON messages FOR ALL USING (auth.uid() = user_id);
  DROP POLICY IF EXISTS "saved_venues_own" ON saved_venues;
  CREATE POLICY "saved_venues_own" ON saved_venues FOR ALL USING (auth.uid() = instructor_id);
  DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
  DROP POLICY IF EXISTS "reviews_insert_instructor" ON reviews;
  DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
  DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
  CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
  CREATE POLICY "reviews_insert_instructor" ON reviews FOR INSERT WITH CHECK (auth.uid() = instructor_id AND EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND instructor_id = auth.uid() AND status = 'completed'));
  CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE USING (auth.uid() = instructor_id);
  CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE USING (auth.uid() = instructor_id);
  DROP POLICY IF EXISTS "enrollments_student_own" ON class_enrollments;
  DROP POLICY IF EXISTS "enrollments_instructor_see" ON class_enrollments;
  DROP POLICY IF EXISTS "enrollments_student_insert" ON class_enrollments;
  DROP POLICY IF EXISTS "enrollments_student_delete" ON class_enrollments;
  CREATE POLICY "enrollments_student_own" ON class_enrollments FOR SELECT USING (auth.uid() = student_id);
  CREATE POLICY "enrollments_instructor_see" ON class_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.instructor_id = auth.uid()));
  CREATE POLICY "enrollments_student_insert" ON class_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id);
  CREATE POLICY "enrollments_student_delete" ON class_enrollments FOR DELETE USING (auth.uid() = student_id);
END $pol$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('venue-images','venue-images',true,10485760,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('instructor-docs','instructor-docs',false,10485760,ARRAY['image/jpeg','image/png','application/pdf'])
  ON CONFLICT (id) DO NOTHING;

DO $pol2$ BEGIN
  DROP POLICY IF EXISTS "venue_images_upload" ON storage.objects;
  DROP POLICY IF EXISTS "venue_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "venue_images_delete" ON storage.objects;
  DROP POLICY IF EXISTS "venue_images_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "instructor_docs_own" ON storage.objects;
  CREATE POLICY "venue_images_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'venue-images' AND auth.role() = 'authenticated');
  CREATE POLICY "venue_images_update" ON storage.objects FOR UPDATE USING (bucket_id = 'venue-images' AND auth.role() = 'authenticated');
  CREATE POLICY "venue_images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'venue-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  CREATE POLICY "venue_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'venue-images');
  CREATE POLICY "instructor_docs_own" ON storage.objects FOR ALL USING (bucket_id = 'instructor-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
END $pol2$;
`

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('s')
  if (secret !== 'ws2026setup') {
    return NextResponse.json({ error: 'no' }, { status: 401 })
  }

  const pass = encodeURIComponent('OriY2611$&!')
  const ref = 'qfrjvkfrzdsrfxjmxxop'
  // Try transaction pooler (6543) first, then session pooler (5432), then direct
  const connStrings = [
    `postgresql://postgres.${ref}:${pass}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${pass}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${pass}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${pass}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`,
  ]

  const errors: string[] = []

  for (const connString of connStrings) {
    const host = connString.split('@')[1]?.split('/')[0]
    const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
    try {
      await client.connect()
      await client.query(SCHEMA)
      await client.end()
      return NextResponse.json({ ok: true, message: `Schema applied via ${host}` })
    } catch (err: unknown) {
      await client.end().catch(() => {})
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${host}: ${msg}`)
      // Only stop early on a real SQL error (not connection errors)
      if (!msg.includes('ENOTFOUND') && !msg.includes('ECONNREFUSED') && !msg.includes('not found') && !msg.includes('ETIMEDOUT') && !msg.includes('timeout')) {
        return NextResponse.json({ ok: false, error: msg, tried: errors }, { status: 500 })
      }
    }
  }
  return NextResponse.json({ ok: false, error: 'All hosts failed', details: errors }, { status: 500 })
}
