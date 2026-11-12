import { handleAuthProxyRequest } from "@neon/auth/server";
import { handleErrors, HttpError, jsonHeaders } from "./http.ts";

const methods = new Map([
  ["get-session", "GET"],
  ["token", "GET"],
  ["sign-out", "POST"],
  ["email-otp/send-verification-otp", "POST"],
  ["sign-in/email-otp", "POST"],
]);

export function authProxy(request: Request) {
  return handleErrors(async () => {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    if (methods.get(path) !== request.method)
      throw new HttpError(404, "NOT_FOUND");
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !cookieSecret || cookieSecret.length < 32)
      throw new HttpError(503, "AUTH_NOT_CONFIGURED");
    const origin = request.headers.get("origin");
    if (request.method === "POST" && origin !== new URL(request.url).origin)
      throw new HttpError(403, "ORIGIN_NOT_ALLOWED");
    const response = await handleAuthProxyRequest({
      request,
      path,
      baseUrl,
      cookieSecret,
      sameSite: "lax",
    });
    for (const [key, value] of Object.entries(jsonHeaders))
      response.headers.set(key, value);
    return response;
  });
}
