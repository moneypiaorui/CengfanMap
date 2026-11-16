import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import session from "../api/auth/get-session";
import token from "../api/auth/token";
import signOut from "../api/auth/sign-out";
import sendCode from "../api/auth/email-otp/send-verification-otp";
import signIn from "../api/auth/sign-in/email-otp";

const appOrigin = "https://app.example.test";
const received: { path: string; method: string; origin?: string; cookie?: string; body: unknown }[] = [];
const upstream = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  received.push({
    path: request.url ?? "", method: request.method ?? "",
    origin: request.headers.origin, cookie: request.headers.cookie,
    body: text ? JSON.parse(text) : undefined,
  });
  response.setHeader("Content-Type", "application/json");
  if (request.url === "/db/auth/sign-in/email-otp") {
    response.statusCode = 401;
    response.end(JSON.stringify({ code: "INVALID_OTP", message: "Invalid OTP" }));
  } else if (request.url === "/db/auth/get-session") {
    response.end("null");
  } else if (request.url === "/db/auth/token") {
    response.end(JSON.stringify({ token: "test-jwt" }));
  } else {
    response.end(JSON.stringify({ success: true }));
  }
});
let baseUrl: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  baseUrl = `http://127.0.0.1:${address.port}/db/auth`;
});
beforeEach(() => {
  received.length = 0;
  vi.stubEnv("NEON_AUTH_BASE_URL", baseUrl);
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "test-cookie-secret-with-at-least-32-characters");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    upstream.close((error) => error ? reject(error) : resolve()),
  );
});

function post(path: string, body: unknown = {}, origin = appOrigin) {
  return new Request(appOrigin + "/api/auth/" + path, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("forwards the nested OTP send route through the real SDK with its body and origin", async () => {
  const body = { email: "student@example.test", type: "sign-in" };
  const response = await sendCode.fetch(post("email-otp/send-verification-otp", body));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(received).toMatchObject([{
    path: "/db/auth/email-otp/send-verification-otp", method: "POST", origin: appOrigin, body,
  }]);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("forwards the nested sign-in route and preserves an invalid-code response", async () => {
  const body = { email: "student@example.test", otp: "000000" };
  const response = await signIn.fetch(post("sign-in/email-otp", body));
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ code: "INVALID_OTP" });
  expect(received[0]).toMatchObject({ path: "/db/auth/sign-in/email-otp", body });
});

it("keeps session/token routes and forwards only Neon Auth cookies", async () => {
  const response = await session.fetch(new Request(appOrigin + "/api/auth/get-session", {
    headers: { Cookie: "__Secure-neon-auth.session_token=test-session; unrelated=private" },
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(received[0].cookie).toContain("__Secure-neon-auth.session_token=test-session");
  expect(received[0].cookie).not.toContain("unrelated");
  expect(await (await token.fetch(new Request(appOrigin + "/api/auth/token"))).json())
    .toEqual({ token: "test-jwt" });
});

it("keeps the sign-out POST route", async () => {
  expect((await signOut.fetch(post("sign-out"))).status).toBe(200);
  expect(received[0]).toMatchObject({ path: "/db/auth/sign-out", method: "POST" });
});

it("returns Allow for wrong methods and rejects cross-origin posts before forwarding", async () => {
  const wrongMethod = await sendCode.fetch(new Request(appOrigin + "/api/auth/email-otp/send-verification-otp"));
  expect(wrongMethod.status).toBe(405);
  expect(wrongMethod.headers.get("allow")).toBe("POST");
  const crossOrigin = await sendCode.fetch(post("email-otp/send-verification-otp", {}, "https://other.example.test"));
  expect(crossOrigin.status).toBe(403);
  expect(await crossOrigin.json()).toEqual({ error: "ORIGIN_NOT_ALLOWED" });
  expect(received).toHaveLength(0);
});

it("reports missing configuration without trying an upstream request", async () => {
  vi.stubEnv("NEON_AUTH_BASE_URL", "");
  const response = await sendCode.fetch(post("email-otp/send-verification-otp"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "AUTH_NOT_CONFIGURED" });
  expect(received).toHaveLength(0);
});
