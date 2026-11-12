CREATE TABLE IF NOT EXISTS cengfan.destination_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES cengfan.students(id),
  submitter_id text NOT NULL,
  submitter_email text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('undergraduate', 'master', 'doctor')),
  kind text NOT NULL CHECK (kind IN ('study', 'employment', 'other')),
  year integer NOT NULL CHECK (year BETWEEN 2023 AND 2100),
  organization text NOT NULL CHECK (length(btrim(organization)) BETWEEN 1 AND 120),
  detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 120),
  province text NOT NULL CHECK (length(btrim(province)) BETWEEN 1 AND 30),
  city text NOT NULL CHECK (length(btrim(city)) BETWEEN 1 AND 60),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text NOT NULL DEFAULT '' CHECK (length(rejection_reason) <= 500),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS submissions_owner_time ON cengfan.destination_submissions(submitter_id, submitted_at DESC);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS submissions_public ON cengfan.destination_submissions(student_id, year DESC, reviewed_at DESC) WHERE status = 'approved';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS submissions_pending ON cengfan.destination_submissions(submitted_at) WHERE status = 'pending';
