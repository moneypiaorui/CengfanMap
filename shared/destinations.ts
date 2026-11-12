export const stages = {
  undergraduate: "本科毕业",
  master: "硕士毕业",
  doctor: "博士毕业",
} as const;
export const destinationKinds = {
  study: "继续升学",
  employment: "就业",
  other: "其他去向",
} as const;
export const provinces = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
  "台湾",
  "境外",
];

export interface DestinationInput {
  studentId: string;
  stage: keyof typeof stages;
  kind: keyof typeof destinationKinds;
  year: number;
  organization: string;
  detail: string;
  province: string;
  city: string;
  note: string;
}

export interface Destination extends Omit<DestinationInput, "note"> {
  id: string;
  reviewedAt: string;
}

export interface Submission extends DestinationInput {
  id: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  rejectionReason: string;
}

export interface ReviewSubmission extends Submission {
  submitterEmail: string;
}

export class InvalidSubmissionError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InvalidSubmissionError();
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new InvalidSubmissionError();
  return value.trim();
}

export function parseId(value: unknown) {
  const id = text(value, 36);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new InvalidSubmissionError();
  return id;
}

export function parseDestinationInput(value: unknown): DestinationInput {
  const row = record(value);
  if (
    typeof row.stage !== "string" ||
    !Object.hasOwn(stages, row.stage) ||
    typeof row.kind !== "string" ||
    !Object.hasOwn(destinationKinds, row.kind) ||
    typeof row.year !== "number" ||
    !Number.isInteger(row.year) ||
    row.year < 2023 ||
    row.year > 2100
  )
    throw new InvalidSubmissionError();
  const province = text(row.province, 30);
  if (!provinces.includes(province)) throw new InvalidSubmissionError();
  const city = text(row.city, 60);
  return {
    studentId: parseId(row.studentId),
    stage: row.stage as DestinationInput["stage"],
    kind: row.kind as DestinationInput["kind"],
    year: row.year,
    organization: text(row.organization, 120),
    detail: text(row.detail, 120, false),
    province,
    city: province === "境外" ? city : city.replace(/市$/, "") || city,
    note: text(row.note ?? "", 500, false),
  };
}

export function parseDestination(value: unknown): Destination {
  const row = record(value);
  const input = parseDestinationInput({ ...row, note: "" });
  const reviewedAt = text(row.reviewedAt, 64);
  if (!Number.isFinite(Date.parse(reviewedAt)))
    throw new InvalidSubmissionError();
  return {
    id: parseId(row.id),
    studentId: input.studentId,
    stage: input.stage,
    kind: input.kind,
    year: input.year,
    organization: input.organization,
    detail: input.detail,
    province: input.province,
    city: input.city,
    reviewedAt,
  };
}
