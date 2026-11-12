import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildMigrationPlan } from "./plan.ts";
import { runQueries } from "../server/database.ts";
import { parseDirectoryData } from "../shared/directory.ts";

export async function migrate() {
  const [schema, students, teachers] = await Promise.all([
    readFile(new URL("./migrations/001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("./seed/students.json", import.meta.url), "utf8"),
    readFile(new URL("./seed/teachers.json", import.meta.url), "utf8"),
  ]);
  const data = parseDirectoryData({
    schemaVersion: 1,
    students: JSON.parse(students),
    teachers: JSON.parse(teachers),
  });
  const plan = buildMigrationPlan(schema, data);
  const rows = await runQueries(plan.queries, {
    readOnly: false,
    isolationLevel: "ReadCommitted",
    timeoutMs: 30000,
  });
  const totals = rows.at(-1)?.[0];
  if (totals?.checksum !== plan.checksum)
    throw new Error(
      "Applied seed differs from the local snapshot; use a new migration version.",
    );
  return {
    studentsInserted: rows[plan.studentsIndex].length,
    teachersInserted: rows[plan.teachersIndex].length,
    alreadyImported: rows[plan.markerIndex].length === 0,
    totalStudents: totals.students,
    totalTeachers: totals.teachers,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  migrate()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error: unknown) => {
      console.error(
        "Migration failed:",
        error instanceof Error ? error.name : "UnknownError",
      );
      process.exitCode = 1;
    });
}
