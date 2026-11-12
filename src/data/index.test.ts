import { describe, expect, it } from "vitest";
import students from "../../db/seed/students.json";
import { filterStudents as filterRecords } from "./index";
const filterStudents = (query: string, province: string, city = "") =>
  filterRecords(students, query, province, city);
describe("classmate search and filtering", () => {
  it("preserves all 49 unique classmates with complete location data", () => {
    expect(students).toHaveLength(49);
    expect(new Set(students.map((s) => s.name)).size).toBe(49);
    expect(students.every((s) => s.province && s.city && s.school)).toBe(true);
  });
  it("matches names, schools and cities, trimming input", () => {
    expect(filterStudents(" 高金锋 ", "").map((s) => s.name)).toEqual([
      "高金锋",
    ]);
    expect(
      filterStudents("安徽大学", "").every((s) =>
        s.school.includes("安徽大学"),
      ),
    ).toBe(true);
    expect(filterStudents("合肥", "").length).toBeGreaterThan(0);
  });
  it("combines province and city with search rather than losing filters", () => {
    const expected = students.filter(
      (s) =>
        s.province === "安徽" &&
        s.city === "合肥" &&
        s.school.includes("安徽大学"),
    );
    expect(filterStudents("安徽大学", "安徽", "合肥")).toEqual(expected);
    expect(filterStudents("安徽大学", "北京")).toEqual([]);
  });
  it("handles empty and unmatched searches", () => {
    expect(filterStudents("  ", "")).toEqual(students);
    expect(filterStudents("不存在的学校xyz", "")).toEqual([]);
  });
});
