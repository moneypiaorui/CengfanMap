import type { DirectoryData } from "../shared/directory.ts";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function createDirectoryHandler(read: () => Promise<DirectoryData>) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        { error: "METHOD_NOT_ALLOWED" },
        { status: 405, headers: { ...headers, Allow: "GET, HEAD" } },
      );
    }
    try {
      const data = await read();
      return new Response(
        request.method === "HEAD" ? null : JSON.stringify(data),
        { status: 200, headers },
      );
    } catch (error) {
      console.error(
        "directory_read_failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      return Response.json(
        { error: "DIRECTORY_UNAVAILABLE" },
        { status: 503, headers },
      );
    }
  };
}
