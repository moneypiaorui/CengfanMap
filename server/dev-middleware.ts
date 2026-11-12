import type { IncomingMessage, ServerResponse } from "node:http";
import api from "../api/directory.ts";

export function directoryMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) {
  if (request.url?.split("?")[0] !== "/api/directory") return next();
  const input = new Request(new URL(request.url, "http://localhost"), {
    method: request.method ?? "GET",
  });
  void api
    .fetch(input)
    .then(async (result) => {
      response.statusCode = result.status;
      result.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await result.arrayBuffer()));
    })
    .catch(next);
}
