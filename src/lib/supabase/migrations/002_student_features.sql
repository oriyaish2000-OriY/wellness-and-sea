-- Student class enrollments
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, student_id)
);
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_student_own" ON class_enrollments FOR SELECT
  USING (auth.uid() = student_id);
CREATE POLICY "enrollments_instructor_see" ON class_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.instructor_id = auth.uid()
    )
  );
CREATE POLICY "enrollments_student_insert" ON class_enrollments FOR INSERT
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "enrollments_student_delete" ON class_enrollments FOR DELETE
  USING (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_booking ON class_enrollments(booking_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON class_enrollments(student_id);

-- Terms acceptance tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
