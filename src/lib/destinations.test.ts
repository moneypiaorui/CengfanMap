import { expect, it } from "vitest";
import students from "../../db/seed/students.json";
import { currentStudents } from "./destinations";
import type { Destination } from "../../shared/destinations";
it("uses the latest approved year and review without changing the undergraduate source", () => {
  const base = {
    id: crypto.randomUUID(),
    studentId: students[0].id,
    stage: "undergraduate",
    kind: "study",
    year: 2027,
    organization: "研究生学校",
    detail: "计算机",
    province: "安徽",
    city: "合肥",
    reviewedAt: "2027-06-01T00:00:00Z",
  } satisfies Destination;
  const next = {
    ...base,
    id: crypto.randomUUID(),
    year: 2030,
    stage: "master" as const,
    kind: "employment" as const,
    organization: "工作单位",
    province: "浙江",
    city: "杭州",
  };
  const result = currentStudents(students, [next, base]);
  expect(result[0].school).toBe("工作单位");
  expect(result[0].city).toBe("杭州");
  expect(result[1]).toEqual(students[1]);
  expect(students[0].school).not.toBe("工作单位");
  expect(
    currentStudents(students, [
      base,
      { ...base, organization: "更正学校", reviewedAt: "2027-07-01T00:00:00Z" },
    ])[0].school,
  ).toBe("更正学校");
});
