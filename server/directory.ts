import { parseDirectoryData } from "../shared/directory.ts";
import { runQueries } from "./database.ts";
import type { SqlStatement } from "./database.ts";

export const directoryQueries: SqlStatement[] = [
  {
    text: "SELECT id::text, name, school, city, province, major FROM cengfan.students ORDER BY sort_order, id",
  },
  {
    text: 'SELECT id::text, name, subject, nickname, image_filename AS image, video_url AS "videoUrl" FROM cengfan.teachers ORDER BY sort_order, id',
  },
  {
    text: `SELECT id::text, student_id::text AS "studentId", stage, kind, year, organization,
      detail, province, city, reviewed_at::text AS "reviewedAt"
      FROM cengfan.destination_submissions WHERE status = 'approved'
      ORDER BY year DESC, reviewed_at DESC, id`,
  },
];

export function directoryFromRows(rows: unknown[][]) {
  return parseDirectoryData({
    schemaVersion: 1,
    students: rows[0],
    teachers: rows[1],
    destinations: rows[2] ?? [],
  });
}

export async function readDirectory() {
  const rows = await runQueries(directoryQueries, {
    readOnly: true,
    isolationLevel: "RepeatableRead",
  });
  return directoryFromRows(rows);
}
