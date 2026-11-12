import {
  InvalidSubmissionError,
  parseDestinationInput,
  parseId,
} from "../shared/destinations.ts";
import { requireUser } from "./auth.ts";
import { createSubmissionStore } from "./submissions.ts";
import { handleErrors, HttpError, json, readJson } from "./http.ts";

export function createSubmissionHandlers(
  store = createSubmissionStore(),
  authenticate = requireUser,
) {
  return {
    submissions(request: Request) {
      return handleErrors(async () => {
        if (!["GET", "POST"].includes(request.method))
          return new Response(null, {
            status: 405,
            headers: { Allow: "GET, POST" },
          });
        const user = await authenticate(request);
        if (request.method === "GET")
          return json({ submissions: await store.own(user) });
        const body = await readJson(request);
        try {
          const data = parseDestinationInput(body);
          const id = parseId((body as Record<string, unknown>).id);
          return json(await store.submit(id, data, user), 202);
        } catch (error) {
          if (error instanceof InvalidSubmissionError)
            throw new HttpError(400, "INVALID_SUBMISSION");
          throw error;
        }
      });
    },
    review(request: Request) {
      return handleErrors(async () => {
        if (!["GET", "POST"].includes(request.method))
          return new Response(null, {
            status: 405,
            headers: { Allow: "GET, POST" },
          });
        const user = await authenticate(request, true);
        if (request.method === "GET")
          return json({ submissions: await store.queue(), email: user.email });
        const body = (await readJson(request)) as Record<string, unknown>;
        let id;
        try {
          id = parseId(body?.id);
        } catch {
          throw new HttpError(400, "INVALID_SUBMISSION");
        }
        if (body.decision !== "approved" && body.decision !== "rejected")
          throw new HttpError(400, "INVALID_SUBMISSION");
        const reason =
          typeof body.reason === "string" ? body.reason.trim() : "";
        if (reason.length > 500 || (body.decision === "rejected" && !reason))
          throw new HttpError(400, "REJECTION_REASON_REQUIRED");
        return json(await store.review(id, body.decision, reason, user));
      });
    },
  };
}
