import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authClient, sendSignInCode, signInWithCode } from "../lib/auth";

export default function EmailGate({
  children,
}: {
  children: (email: string) => ReactNode;
}) {
  const { data, isPending, refetch } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const result = await sendSignInCode(email.trim());
      if (result.error) throw new Error("验证码暂时无法发送，请稍后重试。");
      setSent(true);
      setCooldown(60);
    } catch {
      setError("验证码暂时无法发送，请检查邮箱后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sent) return sendCode();
    setBusy(true);
    setError("");
    try {
      const result = await signInWithCode(email.trim(), otp);
      if (result.error) throw new Error("验证码错误或已过期，请重新获取。");
      await refetch();
    } catch {
      setError("验证码错误或已过期，请重新获取。");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <p role="status">正在确认登录状态…</p>;
  if (data?.user)
    return (
      <>
        <div className="account-strip">
          <span>已验证：{data.user.email}</span>
          <button
            type="button"
            onClick={async () => {
              setError("");
              try {
                await authClient.signOut();
                await refetch();
                setSent(false);
                setOtp("");
              } catch {
                setError("暂时无法退出，请重试。");
              }
            }}
          >
            退出登录
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {children(data.user.email)}
      </>
    );

  return (
    <form className="destination-form email-form" onSubmit={submit}>
      <div className="form-intro">
        <h3>先验证你的邮箱</h3>
        <p>无需设置密码。邮箱仅用于确认提交来源，不会公开展示。</p>
      </div>
      <label>
        邮箱
        <input
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          disabled={sent || busy}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {sent && (
        <>
          <p role="status">验证码已发送，请查看收件箱或垃圾邮件。</p>
          <label>
            邮箱验证码
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="primary-button" disabled={busy}>
          {busy ? "正在处理…" : sent ? "验证并继续" : "获取验证码"}
        </button>
        {sent && (
          <>
            <button
              type="button"
              disabled={busy || cooldown > 0}
              onClick={sendCode}
            >
              {cooldown ? `${cooldown} 秒后可重发` : "重新发送"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setOtp("");
                setError("");
              }}
            >
              更换邮箱
            </button>
          </>
        )}
      </div>
    </form>
  );
}
