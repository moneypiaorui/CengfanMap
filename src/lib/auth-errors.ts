export function authErrorMessage(error: unknown, step: "send" | "verify") {
  const detail =
    error && typeof error === "object"
      ? (error as { code?: unknown; error?: unknown; status?: unknown })
      : undefined;
  const code = detail?.code ?? detail?.error;
  if (detail?.status === 429 || code === "TOO_MANY_REQUESTS")
    return "操作过于频繁，请稍后再试。";
  if (code === "INVALID_EMAIL") return "邮箱地址格式不正确，请检查后重试。";
  if (
    detail?.status === 404 || detail?.status === 403 ||
    (typeof detail?.status === "number" && detail.status >= 500) ||
    code === "AUTH_NOT_CONFIGURED"
  )
    return "邮箱登录服务暂时不可用，请稍后重试。";
  if (error instanceof TypeError)
    return "网络连接异常，请检查网络后重试。";
  return step === "send"
    ? "验证码暂时无法发送，请稍后重试。"
    : "验证码错误或已过期，请重新获取。";
}
