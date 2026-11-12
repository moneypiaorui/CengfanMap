import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

export const authClient = createAuthClient(
  window.location.origin + "/api/auth",
  {
    adapter: BetterAuthReactAdapter(),
  },
);

// The managed SDK installs these plugins, but 0.8.2's pinned fetch types conflict
// with its current Better Auth dependency. Keep the supported SDK HTTP surface
// at this boundary rather than adding plugins or weakening application types.
export async function sendSignInCode(email: string) {
  return authClient.$fetch("/email-otp/send-verification-otp", {
    method: "POST",
    body: { email, type: "sign-in" },
  });
}

export async function signInWithCode(email: string, otp: string) {
  return authClient.$fetch("/sign-in/email-otp", {
    method: "POST",
    body: { email, otp },
  });
}

const errors: Record<string, string> = {
  SIGN_IN_REQUIRED: "请先验证邮箱。",
  SESSION_EXPIRED: "登录已过期，请退出后重新验证邮箱。",
  VERIFIED_EMAIL_REQUIRED: "请先完成邮箱验证码验证。",
  ADMIN_REQUIRED: "这个邮箱没有审核权限。",
  AUTH_NOT_CONFIGURED: "登录服务暂未开放，请稍后再试。",
  INVALID_SUBMISSION: "填写内容不完整或格式有误，请检查后重试。",
  PENDING_OR_LIMIT_REACHED:
    "你已为这位同学提交过待审核记录，或短时间提交过于频繁，请稍后重试。",
  ALREADY_REVIEWED: "这条记录已处理，请刷新列表。",
  REJECTION_REASON_REQUIRED: "请填写退回原因。",
};

export async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // The managed wrapper injects its signed JWT into session.token from the
  // set-auth-jwt header; its /token fetch path also shares the session cache.
  const { data, error } = await authClient.getSession();
  const token = data?.session.token;
  if (error || !token) throw new Error(errors.SIGN_IN_REQUIRED);
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: "Bearer " + token,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(errors[body.error] ?? "暂时无法处理，请稍后重试。");
  return body as T;
}
