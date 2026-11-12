import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import students from "../db/seed/students.json";
import teachers from "../db/seed/teachers.json";
import { buildMigrationPlan } from "../db/plan";
import { parseDirectoryData } from "../shared/directory";
import { directoryFromRows, directoryQueries } from "./directory";
import { createSubmissionStore } from "./submissions";
import { createSubmissionHandlers } from "./submission-handlers";
import { HttpError } from "./http";
import type { SqlStatement } from "./database";
import type { AuthUser } from "./auth";

let db: PGlite;
const snapshot = parseDirectoryData({ schemaVersion: 1, students, teachers });
const schema = await readFile(
  new URL("../db/migrations/001_initial.sql", import.meta.url),
  "utf8",
);
const upgrade = {
  version: "002_destinations",
  sql: await readFile(
    new URL("../db/migrations/002_destinations.sql", import.meta.url),
    "utf8",
  ),
};
const user: AuthUser = {
  id: "student-user",
  email: "student@example.test",
  isAdmin: false,
};
const admin: AuthUser = {
  id: "reviewer",
  email: "reviewer@example.test",
  isAdmin: true,
};
const input = {
  studentId: students[0].id,
  stage: "undergraduate" as const,
  kind: "study" as const,
  year: 2027,
  organization: "测试研究生院校",
  detail: "计算机科学",
  province: "安徽",
  city: "合肥",
  note: "只给审核人看的备注",
};
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
const store = createSubmissionStore(execute);
const handlers = createSubmissionHandlers(store, async (request, reviewer) => {
  const who =
    request.headers.get("authorization") === "Bearer admin"
      ? admin
      : request.headers.get("authorization") === "Bearer student"
        ? user
        : null;
  if (!who) throw new HttpError(401, "SIGN_IN_REQUIRED");
  if (reviewer && !who.isAdmin) throw new HttpError(403, "ADMIN_REQUIRED");
  return who;
});
const request = (route: string, body: unknown, token = "student") =>
  new Request("http://localhost/api/" + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  db = new PGlite();
  await execute(buildMigrationPlan(schema, snapshot, [upgrade]).queries);
});
afterEach(async () => {
  await db.close();
});

it("keeps pending records private, publishes only after approval, and preserves undergraduate records", async () => {
  const id = randomUUID();
  expect(
    (await handlers.submissions(request("submissions", { id, ...input })))
      .status,
  ).toBe(202);
  expect(
    directoryFromRows(await execute(directoryQueries)).destinations,
  ).toEqual([]);
  const queue = await store.queue();
  expect(queue[0].submitterEmail).toBe(user.email);
  expect(queue[0].note).toBe(input.note);
  expect(
    (
      await handlers.review(
        request("review", { id, decision: "approved" }, "admin"),
      )
    ).status,
  ).toBe(200);
  const publicData = directoryFromRows(await execute(directoryQueries));
  expect(publicData.students).toEqual(snapshot.students);
  expect(publicData.destinations[0].organization).toBe(input.organization);
  expect(JSON.stringify(publicData)).not.toContain(user.email);
  expect(JSON.stringify(publicData)).not.toContain(input.note);
  expect(
    (
      await handlers.review(
        request(
          "review",
          { id, decision: "rejected", reason: "late" },
          "admin",
        ),
      )
    ).status,
  ).toBe(409);
});

it("denies unauthenticated writes and non-admin review even with direct API calls", async () => {
  const body = { id: randomUUID(), ...input };
  expect(
    (await handlers.submissions(request("submissions", body, "invalid")))
      .status,
  ).toBe(401);
  expect(
    (
      await handlers.review(
        request("review", { id: body.id, decision: "approved" }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handlers.review(
        new Request("http://localhost/api/review", {
          headers: { Authorization: "Bearer student" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(await store.queue()).toEqual([]);
});

it("makes retries idempotent, prevents duplicate pending records, and scopes history to the owner", async () => {
  const id = randomUUID();
  await store.submit(id, input, user);
  await store.submit(id, input, user);
  expect(await store.own(user)).toHaveLength(1);
  await expect(store.submit(randomUUID(), input, user)).rejects.toMatchObject({
    status: 409,
  });
  expect(await store.own({ ...user, id: "other" })).toEqual([]);
});

it("retains rejected records for the owner and accepts a corrected resubmission", async () => {
  const id = randomUUID();
  await store.submit(id, input, user);
  expect(
    (
      await handlers.review(
        request("review", { id, decision: "rejected", reason: "" }, "admin"),
      )
    ).status,
  ).toBe(400);
  await store.review(id, "rejected", "请核对学校名称", admin);
  expect((await store.own(user))[0].rejectionReason).toBe("请核对学校名称");
  expect(
    directoryFromRows(await execute(directoryQueries)).destinations,
  ).toEqual([]);
  await store.submit(
    randomUUID(),
    { ...input, organization: "已更正的学校" },
    user,
  );
  expect(await store.own(user)).toHaveLength(2);
});

it("limits verified-account submissions and validates input before touching SQL", async () => {
  for (let index = 0; index < 6; index++)
    await store.submit(
      randomUUID(),
      { ...input, studentId: students[index].id },
      user,
    );
  await expect(
    store.submit(randomUUID(), { ...input, studentId: students[6].id }, user),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (
      await handlers.submissions(
        request("submissions", { id: randomUUID(), ...input, stage: "admin" }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handlers.submissions(
        request("submissions", { id: randomUUID(), ...input, year: 1800 }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handlers.submissions(
        request("submissions", { note: "x".repeat(9000) }),
      )
    ).status,
  ).toBe(413);
});

it("reuses applied schema upgrades and detects changed migration history", async () => {
  const plan = buildMigrationPlan(schema, snapshot, [upgrade]);
  expect(plan.checksum).toBe(
    "b4e18d154f4ffa1b789a31da11d9c868c4192ae88f300aadf72394afad3bc468",
  );
  await store.submit(randomUUID(), input, user);
  await execute(plan.queries);
  expect(await store.own(user)).toHaveLength(1);
  await expect(
    execute(
      buildMigrationPlan(schema, snapshot, [
        { ...upgrade, sql: upgrade.sql + "\n-- changed" },
      ]).queries,
    ),
  ).rejects.toThrow();
});
