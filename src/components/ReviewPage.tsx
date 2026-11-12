import { useEffect, useState } from "react";
import type { Student } from "../../shared/directory";
import { stages, destinationKinds } from "../../shared/destinations";
import type { ReviewSubmission } from "../../shared/destinations";
import { authorizedRequest } from "../lib/auth";
import EmailGate from "./EmailGate";
import useDirectoryData from "../hooks/useDirectoryData";

function Queue({ students }: { students: Student[] }) {
  const [rows, setRows] = useState<ReviewSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(
        (
          await authorizedRequest<{ submissions: ReviewSubmission[] }>(
            "/api/review",
          )
        ).submissions,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "暂时无法加载。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function review(id: string, decision: "approved" | "rejected") {
    if (decision === "rejected" && !reasons[id]?.trim()) {
      setError("请先填写退回原因。");
      return;
    }
    setBusy(id);
    setError("");
    setNotice("");
    try {
      await authorizedRequest("/api/review", {
        method: "POST",
        body: JSON.stringify({ id, decision, reason: reasons[id] ?? "" }),
      });
      setNotice(
        decision === "approved"
          ? "已通过，公开去向已更新。"
          : "已退回，原因可由提交人查看。",
      );
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "处理失败，请重试。");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section aria-label="去向审核列表">
      <div className="review-toolbar">
        <h2>提交记录</h2>
        <button onClick={load} disabled={loading}>
          刷新
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-success">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">正在加载提交记录…</p>
      ) : !error && !rows.length ? (
        <p>还没有待处理的提交。</p>
      ) : (
        rows.map((row) => (
          <article className="review-card" key={row.id}>
            <header>
              <h3>
                {students.find((s) => s.id === row.studentId)?.name} ·{" "}
                {row.year}
              </h3>
              <span className={"status-badge status-" + row.status}>
                {row.status === "pending"
                  ? "待审核"
                  : row.status === "approved"
                    ? "已公开"
                    : "已退回"}
              </span>
            </header>
            <p>
              {stages[row.stage]} · {destinationKinds[row.kind]}
            </p>
            <strong>{row.organization}</strong>
            <p>
              {row.detail || "未补充专业 / 岗位"} · {row.province} {row.city}
            </p>
            <p className="review-private">
              提交邮箱：{row.submitterEmail}
              <br />
              提交时间：{new Date(row.submittedAt).toLocaleString("zh-CN")}
            </p>
            {row.note && <p className="review-private">私人备注：{row.note}</p>}
            {row.status === "pending" ? (
              <>
                <label>
                  退回原因
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={reasons[row.id] ?? ""}
                    onChange={(event) =>
                      setReasons((values) => ({
                        ...values,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={busy !== null}
                    onClick={() => review(row.id, "approved")}
                  >
                    {busy === row.id ? "处理中…" : "审核通过"}
                  </button>
                  <button
                    disabled={busy !== null}
                    onClick={() => review(row.id, "rejected")}
                  >
                    退回修改
                  </button>
                </div>
              </>
            ) : (
              row.rejectionReason && <p>退回原因：{row.rejectionReason}</p>
            )}
          </article>
        ))
      )}
    </section>
  );
}

export default function ReviewPage() {
  const directory = useDirectoryData();
  return (
    <main className="review-page">
      <header className="review-heading">
        <a href="#">← 返回地图</a>
        <h1>去向审核</h1>
        <p>
          仅指定管理员可处理。待审核记录、提交邮箱和私人备注不会出现在公开页面。
        </p>
      </header>
      <EmailGate>
        {(email) =>
          directory.status === "ready" ? (
            <Queue key={email} students={directory.data.students} />
          ) : (
            <p role={directory.status === "error" ? "alert" : "status"}>
              {directory.status === "error"
                ? "同学名单加载失败，请刷新页面。"
                : "正在加载同学名单…"}
            </p>
          )
        }
      </EmailGate>
    </main>
  );
}
