import { createHash } from "node:crypto";
import { parseDirectoryData } from "../shared/directory.ts";
import type { DirectoryData } from "../shared/directory.ts";
import type { SqlStatement } from "../server/database.ts";

export const seedVersion = "initial-directory-v1";

export function buildMigrationPlan(schema: string, input: DirectoryData) {
  const data = parseDirectoryData(input);
  const checksum = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  const queries: SqlStatement[] = [
    { text: "SELECT pg_advisory_xact_lock(202335)" },
    ...schema
      .split(/^-- statement-breakpoint\s*$/m)
      .map((text) => ({ text: text.trim() }))
      .filter((query) => query.text),
  ];
  const studentsIndex = queries.length;
  queries.push({
    text: `INSERT INTO cengfan.students (id, name, school, city, province, major, sort_order)
      SELECT id, name, school, city, province, major, sort_order
      FROM jsonb_to_recordset($1::jsonb) AS seed(id uuid, name text, school text, city text, province text, major text, sort_order integer)
      WHERE NOT EXISTS (SELECT 1 FROM cengfan.seed_migrations WHERE version = $2)
      ON CONFLICT (id) DO NOTHING RETURNING id`,
    values: [
      JSON.stringify(
        data.students.map((student, sort_order) => ({
          ...student,
          sort_order,
        })),
      ),
      seedVersion,
    ],
  });
  const teachersIndex = queries.length;
  queries.push({
    text: `INSERT INTO cengfan.teachers (id, name, subject, nickname, image_filename, video_url, sort_order)
      SELECT id, name, subject, nickname, image_filename, video_url, sort_order
      FROM jsonb_to_recordset($1::jsonb) AS seed(id uuid, name text, subject text, nickname text, image_filename text, video_url text, sort_order integer)
      WHERE NOT EXISTS (SELECT 1 FROM cengfan.seed_migrations WHERE version = $2)
      ON CONFLICT (id) DO NOTHING RETURNING id`,
    values: [
      JSON.stringify(
        data.teachers.map((teacher, sort_order) => ({
          ...teacher,
          image_filename: teacher.image ?? null,
          video_url: teacher.videoUrl ?? null,
          sort_order,
        })),
      ),
      seedVersion,
    ],
  });
  const markerIndex = queries.length;
  queries.push({
    text: "INSERT INTO cengfan.seed_migrations (version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING RETURNING version",
    values: [seedVersion, checksum],
  });
  queries.push({
    text: `SELECT
      (SELECT count(*)::int FROM cengfan.students) AS students,
      (SELECT count(*)::int FROM cengfan.teachers) AS teachers,
      (SELECT checksum FROM cengfan.seed_migrations WHERE version = $1) AS checksum`,
    values: [seedVersion],
  });
  return { queries, checksum, studentsIndex, teachersIndex, markerIndex };
}
