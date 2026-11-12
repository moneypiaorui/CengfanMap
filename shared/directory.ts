import { parseDestination } from "./destinations.ts";
import type { Destination } from "./destinations.ts";

export interface Student {
  id: string;
  name: string;
  school: string;
  city: string;
  province: string;
  major: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  nickname: string;
  image?: string;
  videoUrl?: string;
}

export interface DirectoryData {
  schemaVersion: 1;
  students: Student[];
  teachers: Teacher[];
  destinations: Destination[];
}

class InvalidDirectoryDataError extends Error {
  constructor() {
    super("Invalid directory data");
    this.name = "InvalidDirectoryDataError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InvalidDirectoryDataError();
  return value as Record<string, unknown>;
}

function text(value: unknown, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    (!allowEmpty && !value.trim())
  )
    throw new InvalidDirectoryDataError();
  return value;
}

function id(value: unknown): string {
  const result = text(value);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      result,
    )
  )
    throw new InvalidDirectoryDataError();
  return result;
}

function uniqueIds(items: { id: string }[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new InvalidDirectoryDataError();
}

export function parseDirectoryData(value: unknown): DirectoryData {
  const payload = record(value);
  if (
    payload.schemaVersion !== 1 ||
    !Array.isArray(payload.students) ||
    !Array.isArray(payload.teachers) ||
    payload.students.length > 10000 ||
    payload.teachers.length > 1000
  )
    throw new InvalidDirectoryDataError();
  const students = payload.students.map((value): Student => {
    const row = record(value);
    return {
      id: id(row.id),
      name: text(row.name),
      school: text(row.school),
      city: text(row.city),
      province: text(row.province),
      major: text(row.major, true),
    };
  });
  const teachers = payload.teachers.map((value): Teacher => {
    const row = record(value);
    const teacher: Teacher = {
      id: id(row.id),
      name: text(row.name),
      subject: text(row.subject),
      nickname: text(row.nickname, true),
    };
    if (row.image !== undefined && row.image !== null) {
      const image = text(row.image);
      if (!/^[a-z0-9_-]+\.(png|jpe?g|webp|avif)$/i.test(image))
        throw new InvalidDirectoryDataError();
      teacher.image = image;
    }
    if (row.videoUrl !== undefined && row.videoUrl !== null) {
      const videoUrl = text(row.videoUrl);
      try {
        if (new URL(videoUrl).protocol !== "https:")
          throw new InvalidDirectoryDataError();
      } catch {
        throw new InvalidDirectoryDataError();
      }
      teacher.videoUrl = videoUrl;
    }
    return teacher;
  });
  uniqueIds(students);
  uniqueIds(teachers);
  const rawDestinations = payload.destinations ?? [];
  if (!Array.isArray(rawDestinations) || rawDestinations.length > 10000)
    throw new InvalidDirectoryDataError();
  const destinations = rawDestinations.map(parseDestination);
  uniqueIds(destinations);
  const studentIds = new Set(students.map((student) => student.id));
  if (
    destinations.some((destination) => !studentIds.has(destination.studentId))
  )
    throw new InvalidDirectoryDataError();
  return { schemaVersion: 1, students, teachers, destinations };
}
