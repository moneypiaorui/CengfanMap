import type { Student } from "../../shared/directory";
import type { Destination } from "../../shared/destinations";

export function currentStudents(
  students: Student[],
  destinations: Destination[],
) {
  const latest = new Map<string, Destination>();
  for (const destination of destinations) {
    const prior = latest.get(destination.studentId);
    if (
      !prior ||
      destination.year > prior.year ||
      (destination.year === prior.year &&
        Date.parse(destination.reviewedAt) > Date.parse(prior.reviewedAt))
    )
      latest.set(destination.studentId, destination);
  }
  return students.map((student) => {
    const destination = latest.get(student.id);
    return destination
      ? {
          ...student,
          school: destination.organization,
          major: destination.detail,
          province: destination.province,
          city: destination.city,
        }
      : student;
  });
}
