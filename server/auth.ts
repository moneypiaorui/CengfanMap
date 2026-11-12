import { createRemoteJWKSet, jwtVerify } from "jose";
import { HttpError } from "./http.ts";

export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function requireUser(
  request: Request,
  admin = false,
): Promise<AuthUser> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new HttpError(401, "SIGN_IN_REQUIRED");
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new HttpError(503, "AUTH_NOT_CONFIGURED");
  const origin = new URL(base).origin;
  let keys = keySets.get(base);
  if (!keys) {
    keys = createRemoteJWKSet(
      new URL(base.replace(/\/$/, "") + "/.well-known/jwks.json"),
      { timeoutDuration: 5000 },
    );
    keySets.set(base, keys);
  }
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      algorithms: ["EdDSA"],
      issuer: origin,
      audience: origin,
      requiredClaims: ["sub", "exp", "iat"],
    }));
  } catch {
    throw new HttpError(401, "SESSION_EXPIRED");
  }
  if (
    !payload.sub ||
    typeof payload.email !== "string" ||
    payload.emailVerified !== true ||
    payload.banned === true
  )
    throw new HttpError(403, "VERIFIED_EMAIL_REQUIRED");
  const email = payload.email.trim().toLowerCase();
  const isAdmin =
    Boolean(process.env.ADMIN_EMAIL) &&
    email === process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (admin && !isAdmin) throw new HttpError(403, "ADMIN_REQUIRED");
  return { id: payload.sub, email, isAdmin };
}
