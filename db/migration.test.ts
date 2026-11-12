import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import students from "./seed/students.json";
import teachers from "./seed/teachers.json";
import { buildMigrationPlan, renderMigrationSql } from "./plan";
import { parseDirectoryData } from "../shared/directory";
import { directoryFromRows, directoryQueries } from "../server/directory";
import type { SqlStatement } from "../server/database";

let db: PGlite;
beforeEach(() => {
  db = new PGlite();
});
afterEach(async () => {
  await db.close();
});
const data = parseDirectoryData({ schemaVersion: 1, students, teachers });
const schema = await readFile(
  new URL("./migrations/001_initial.sql", import.meta.url),
  "utf8",
);
const plan = buildMigrationPlan(schema, data);

async function execute(queries: SqlStatement[]) {
  return db.transaction(async (transaction) => {
    const rows: Record<string, unknown>[][] = [];
    for (const query of queries)
      rows.push(
        (await transaction.query(query.text, query.values)).rows as Record<
          string,
          unknown
        >[],
      );
    return rows;
  });
}

describe("initial PostgreSQL migration", () => {
  it("imports every original record with stable IDs and preserves ordering", async () => {
    const results = await execute(plan.queries);
    expect(results[plan.studentsIndex]).toHaveLength(49);
    expect(results[plan.teachersIndex]).toHaveLength(6);
    const actual = directoryFromRows(await execute(directoryQueries));
    expect(actual).toEqual(data);
  });

  it("the SQL Editor export imports the same complete snapshot", async () => {
    await db.exec(renderMigrationSql(plan.queries));
    expect(directoryFromRows(await execute(directoryQueries))).toEqual(data);
  });

  it("rerunning never overwrites edits, restores deleted records or duplicates rows", async () => {
    await execute(plan.queries);
    await db.query("UPDATE cengfan.students SET school = $1 WHERE id = $2", [
      "更新后的学校",
      data.students[0].id,
    ]);
    await db.query("DELETE FROM cengfan.students WHERE id = $1", [
      data.students[1].id,
    ]);
    await db.query("UPDATE cengfan.teachers SET nickname = $1 WHERE id = $2", [
      "更新后的昵称",
      data.teachers[0].id,
    ]);
    const results = await execute(plan.queries);
    expect(results[plan.studentsIndex]).toHaveLength(0);
    expect(results[plan.teachersIndex]).toHaveLength(0);
    expect(results[plan.markerIndex]).toHaveLength(0);
    const actual = directoryFromRows(await execute(directoryQueries));
    expect(actual.students).toHaveLength(48);
    expect(actual.students[0].school).toBe("更新后的学校");
    expect(
      actual.students.some((student) => student.id === data.students[1].id),
    ).toBe(false);
    expect(actual.teachers[0].nickname).toBe("更新后的昵称");
  });

  it("rolls back the whole import on a database constraint failure", async () => {
    const broken = structuredClone(plan.queries);
    const rows = JSON.parse(broken[plan.studentsIndex].values![0] as string);
    rows[1].school = null;
    broken[plan.studentsIndex].values![0] = JSON.stringify(rows);
    await expect(execute(broken)).rejects.toThrow();
    const result = await db.query<{ schema: string | null }>(
      "SELECT to_regnamespace('cengfan')::text AS schema",
    );
    expect(result.rows[0].schema).toBeNull();
  });
});
