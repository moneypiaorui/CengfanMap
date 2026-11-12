import { readFile, writeFile } from "node:fs/promises";
import { buildMigrationPlan, renderMigrationSql } from "./plan.ts";
import { runQueries } from "../server/database.ts";
import { parseDirectoryData } from "../shared/directory.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--export"))
    throw new Error("Expected no arguments or --export");
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
  if (args[0] === "--export") {
    await writeFile(
      new URL("./import-initial.sql", import.meta.url),
      renderMigrationSql(plan.queries),
    );
    console.log(
      `Generated db/import-initial.sql: ${data.students.length} students, ${data.teachers.length} teachers.`,
    );
    return;
  }
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
  console.log(
    JSON.stringify(
      {
        studentsInserted: rows[plan.studentsIndex].length,
        teachersInserted: rows[plan.teachersIndex].length,
        alreadyImported: rows[plan.markerIndex].length === 0,
        totalStudents: totals.students,
        totalTeachers: totals.teachers,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(
    "Migration command failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  process.exitCode = 1;
});
