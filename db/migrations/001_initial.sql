CREATE SCHEMA IF NOT EXISTS cengfan;

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS cengfan.seed_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS cengfan.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  school text NOT NULL CHECK (length(btrim(school)) > 0),
  city text NOT NULL CHECK (length(btrim(city)) > 0),
  province text NOT NULL CHECK (length(btrim(province)) > 0),
  major text NOT NULL DEFAULT '待补充',
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS cengfan.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  subject text NOT NULL CHECK (length(btrim(subject)) > 0),
  nickname text NOT NULL DEFAULT '',
  image_filename text,
  video_url text CHECK (video_url IS NULL OR video_url ~ '^https://'),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- statement-breakpoint
CREATE OR REPLACE FUNCTION cengfan.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- statement-breakpoint
CREATE OR REPLACE TRIGGER students_touch_updated_at
BEFORE UPDATE ON cengfan.students
FOR EACH ROW EXECUTE FUNCTION cengfan.touch_updated_at();

-- statement-breakpoint
CREATE OR REPLACE TRIGGER teachers_touch_updated_at
BEFORE UPDATE ON cengfan.teachers
FOR EACH ROW EXECUTE FUNCTION cengfan.touch_updated_at();
