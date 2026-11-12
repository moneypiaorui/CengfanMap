import type { Student } from "../../shared/directory";
export type { Student, Teacher, DirectoryData } from "../../shared/directory";

export function getProvinceNames(students: Student[]) {
  return [...new Set(students.map((student) => student.province))].sort(
    (a, b) => a.localeCompare(b, "zh-CN"),
  );
}

export function filterStudents(
  students: Student[],
  query: string,
  province: string,
  city = "",
) {
  const text = query.trim().toLocaleLowerCase();
  return students.filter(
    (s) =>
      (!province || s.province === province) &&
      (!city || s.city === city) &&
      (!text ||
        [s.name, s.school, s.city, s.province, s.major].some((v) =>
          v.toLocaleLowerCase().includes(text),
        )),
  );
}
