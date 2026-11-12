import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { requireUser } from "./auth";

const pair = await generateKeyPair("EdDSA");
const jwk = await exportJWK(pair.publicKey);
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      keys: [{ ...jwk, kid: "test", alg: "EdDSA", use: "sig" }],
    }),
  );
});
let origin: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test address");
  origin = "http://127.0.0.1:" + address.port;
});
afterEach(() => {
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
async function token(
  options: {
    email?: string;
    verified?: boolean;
    issuer?: string;
    audience?: string;
    expiry?: string;
  } = {},
) {
  return new SignJWT({
    email: options.email ?? "reviewer@example.test",
    emailVerified: options.verified ?? true,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: "test" })
    .setSubject("verified-user")
    .setIssuedAt()
    .setIssuer(options.issuer ?? origin)
    .setAudience(options.audience ?? origin)
    .setExpirationTime(options.expiry ?? "5m")
    .sign(pair.privateKey);
}
function setup() {
  vi.stubEnv("NEON_AUTH_BASE_URL", origin + "/db/auth");
  vi.stubEnv("ADMIN_EMAIL", "reviewer@example.test");
}
const request = (token: string) =>
  new Request("http://localhost/api/review", {
    headers: { Authorization: "Bearer " + token },
  });
it("requires a signed, verified administrator email rather than trusting request fields", async () => {
  setup();
  expect((await requireUser(request(await token()), true)).isAdmin).toBe(true);
  await expect(
    requireUser(request(await token({ email: "other@example.test" })), true),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    requireUser(request(await token({ verified: false })), true),
  ).rejects.toMatchObject({ status: 403 });
});
it("rejects wrong issuer, wrong audience, expired, forged and missing tokens", async () => {
  setup();
  for (const value of [
    await token({ issuer: "https://wrong.test" }),
    await token({ audience: "wrong" }),
    await token({ expiry: "-1h" }),
    "forged",
  ])
    await expect(requireUser(request(value), true)).rejects.toMatchObject({
      status: 401,
    });
  await expect(
    requireUser(new Request("http://localhost/api/review")),
  ).rejects.toMatchObject({ status: 401 });
});
