import type { IncomingMessage, ServerResponse } from "node:http";
import api from "../api/directory.ts";
import session from "../api/auth/get-session.ts";
import token from "../api/auth/token.ts";
import signOut from "../api/auth/sign-out.ts";
import sendCode from "../api/auth/email-otp/send-verification-otp.ts";
import signIn from "../api/auth/sign-in/email-otp.ts";
import submissions from "../api/submissions.ts";
import review from "../api/review.ts";
const routes: Record<string, (request: Request) => Promise<Response>> = {
  "/api/directory": api.fetch,
  "/api/submissions": submissions.fetch,
  "/api/review": review.fetch,
  "/api/auth/get-session": session.fetch,
  "/api/auth/token": token.fetch,
  "/api/auth/sign-out": signOut.fetch,
  "/api/auth/email-otp/send-verification-otp": sendCode.fetch,
  "/api/auth/sign-in/email-otp": signIn.fetch,
};

export function directoryMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) {
  const path = request.url?.split("?")[0] ?? "";
  const handle = routes[path];
  if (!handle) return next();
  const method = request.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value))
      value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }
  const input = new Request(
    new URL(
      request.url ?? path,
      "http://" + (request.headers.host ?? "localhost"),
    ),
    {
      method,
      headers,
      ...(method === "GET" || method === "HEAD"
        ? {}
        : { body: request as unknown as ReadableStream, duplex: "half" }),
    } as RequestInit,
  );
  void handle(input)
    .then(async (result) => {
      response.statusCode = result.status;
      result.headers.forEach((value, name) => {
        if (name !== "set-cookie") response.setHeader(name, value);
      });
      const cookies = result.headers.getSetCookie();
      if (cookies.length) response.setHeader("set-cookie", cookies);
      response.end(Buffer.from(await result.arrayBuffer()));
    })
    .catch(next);
}
