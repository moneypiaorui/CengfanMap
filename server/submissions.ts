import type {
  DestinationInput,
  Submission,
  ReviewSubmission,
} from "../shared/destinations.ts";
import type { AuthUser } from "./auth.ts";
import { runQueries } from "./database.ts";
import { HttpError } from "./http.ts";

const columns = `id::text, student_id::text AS "studentId", stage, kind, year, organization, detail,
  province, city, note, status, submitted_at::text AS "submittedAt", rejection_reason AS "rejectionReason"`;

export function createSubmissionStore(execute = runQueries) {
  return {
    async submit(id: string, data: DestinationInput, user: AuthUser) {
      const results = await execute(
        [
          {
            text: "SELECT pg_advisory_xact_lock(hashtext($1))",
            values: [user.id],
          },
          {
            text: `WITH prior AS (
            SELECT id, status FROM cengfan.destination_submissions WHERE id = $1::uuid AND submitter_id = $2
          ), inserted AS (
            INSERT INTO cengfan.destination_submissions
              (id, submitter_id, submitter_email, student_id, stage, kind, year, organization, detail, province, city, note)
            SELECT $1::uuid, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12
            WHERE EXISTS (SELECT 1 FROM cengfan.students WHERE id = $4::uuid)
              AND NOT EXISTS (SELECT 1 FROM prior)
              AND (SELECT count(*) FROM cengfan.destination_submissions WHERE submitter_id = $2 AND submitted_at > now() - interval '1 hour') < 6
              AND NOT EXISTS (SELECT 1 FROM cengfan.destination_submissions WHERE submitter_id = $2 AND student_id = $4::uuid AND status = 'pending')
            ON CONFLICT (id) DO NOTHING RETURNING id, status
          ) SELECT id::text, status FROM inserted UNION ALL SELECT id::text, status FROM prior`,
            values: [
              id,
              user.id,
              user.email,
              data.studentId,
              data.stage,
              data.kind,
              data.year,
              data.organization,
              data.detail,
              data.province,
              data.city,
              data.note,
            ],
          },
        ],
        { readOnly: false },
      );
      if (!results[1][0]) throw new HttpError(409, "PENDING_OR_LIMIT_REACHED");
      return { id: results[1][0].id, status: results[1][0].status };
    },
    async own(user: AuthUser) {
      const [rows] = await execute([
        {
          text: `SELECT ${columns} FROM cengfan.destination_submissions WHERE submitter_id = $1 ORDER BY submitted_at DESC LIMIT 20`,
          values: [user.id],
        },
      ]);
      return rows as unknown as Submission[];
    },
    async queue() {
      const [rows] = await execute([
        {
          text: `SELECT ${columns}, submitter_email AS "submitterEmail" FROM cengfan.destination_submissions ORDER BY (status = 'pending') DESC, submitted_at DESC LIMIT 100`,
        },
      ]);
      return rows as unknown as ReviewSubmission[];
    },
    async review(
      id: string,
      decision: "approved" | "rejected",
      reason: string,
      user: AuthUser,
    ) {
      const [rows] = await execute(
        [
          {
            text: `UPDATE cengfan.destination_submissions SET status = $2, reviewed_at = now(), reviewed_by = $3, rejection_reason = $4 WHERE id = $1::uuid AND status = 'pending' RETURNING id::text`,
            values: [
              id,
              decision,
              user.id,
              decision === "rejected" ? reason : "",
            ],
          },
        ],
        { readOnly: false },
      );
      if (!rows[0]) throw new HttpError(409, "ALREADY_REVIEWED");
      return { id, status: decision };
    },
  };
}
