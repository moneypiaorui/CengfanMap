import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import students from "../db/seed/students.json";
import teachers from "../db/seed/teachers.json";
import { buildMigrationPlan } from "../db/plan";
import { parseDirectoryData } from "../shared/directory";
import { createDirectoryHandler } from "./handler";
import {
  directoryFromRows,
  directoryQueries,
  readDirectory,
} from "./directory";
import type { SqlStatement } from "./database";

const db = new PGlite();
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
const snapshot = parseDirectoryData({ schemaVersion: 1, students, teachers });
const handler = createDirectoryHandler(async () =>
  directoryFromRows(await execute(directoryQueries)),
);
beforeAll(async () => {
  const schema = await readFile(
    new URL("../db/migrations/001_initial.sql", import.meta.url),
    "utf8",
  );
  await execute(buildMigrationPlan(schema, snapshot).queries);
});
afterAll(async () => {
  await db.close();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("serves fresh database data without rebuilding and disables response caching", async () => {
  const initial = await handler(new Request("http://localhost/api/directory"));
  expect(initial.status).toBe(200);
  expect(initial.headers.get("cache-control")).toBe("no-store");
  expect(await initial.json()).toEqual(snapshot);
  await db.query("UPDATE cengfan.students SET major = $1 WHERE id = $2", [
    "数据库中更新的专业",
    snapshot.students[0].id,
  ]);
  const updated = await handler(new Request("http://localhost/api/directory"));
  const payload = parseDirectoryData(await updated.json());
  expect(payload.students[0].major).toBe("数据库中更新的专业");
  const head = await handler(
    new Request("http://localhost/api/directory", { method: "HEAD" }),
  );
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
});

it("rejects writes before accessing the database", async () => {
  const read = vi.fn();
  const response = await createDirectoryHandler(read)(
    new Request("http://localhost/api/directory", { method: "POST" }),
  );
  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("GET, HEAD");
  expect(read).not.toHaveBeenCalled();
});

it("reports missing database configuration without returning seed data", async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await createDirectoryHandler(readDirectory)(
    new Request("http://localhost/api/directory"),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "DIRECTORY_UNAVAILABLE" });
});

it("never exposes database credentials or query errors to the browser", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const failing = createDirectoryHandler(async () => {
    throw new Error(
      "postgresql://private-user:private-password@private-host/database",
    );
  });
  const response = await failing(new Request("http://localhost/api/directory"));
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).not.toContain("private-");
  expect(body).not.toContain("postgresql");
});
