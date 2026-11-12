import { createSubmissionHandlers } from "../server/submission-handlers.ts";
export default { fetch: createSubmissionHandlers().submissions };
