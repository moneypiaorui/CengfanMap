export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: jsonHeaders });
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_SUBMISSION");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new HttpError(413, "REQUEST_TOO_LARGE");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_SUBMISSION");
  }
}

export async function handleErrors(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.code }, error.status);
    console.error(
      "request_failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json({ error: "SERVICE_UNAVAILABLE" }, 503);
  }
}
