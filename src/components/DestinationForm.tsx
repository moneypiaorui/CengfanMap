import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Student } from "../../shared/directory";
import { stages, destinationKinds, provinces } from "../../shared/destinations";
import type { DestinationInput, Submission } from "../../shared/destinations";
import { authorizedRequest } from "../lib/auth";
import EmailGate from "./EmailGate";

const statusNames = {
  pending: "待审核",
  approved: "已公开",
  rejected: "已退回",
};

function FillForm({ students, email }: { students: Student[]; email: string }) {
  const requestId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [records, setRecords] = useState<Submission[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [kind, setKind] = useState<DestinationInput["kind"]>("study");
  async function load() {
    try {
      setRecords(
        (
          await authorizedRequest<{ submissions: Submission[] }>(
            "/api/submissions",
          )
        ).submissions,
      );
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }
  useEffect(() => {
    void load();
  }, [email]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const data = Object.fromEntries(values);
    try {
      await authorizedRequest("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          year: Number(data.year),
          id: requestId.current,
        }),
      });
      requestId.current = crypto.randomUUID();
      setMessage("提交成功，审核通过后会公开展示。原本科录取信息不会被覆盖。");
      form.reset();
      setKind("study");
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "暂时无法提交，请重试。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="form-intro">
        <h3>记录下一站</h3>
        <p>请本人填报。每次更新都保留为一条新记录，审核通过后再公开。</p>
      </div>
      <form className="destination-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            同学姓名
            <select name="studentId" defaultValue="" required>
              <option value="" disabled>
                请选择你自己
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-pair">
            <label>
              毕业阶段
              <select name="stage" defaultValue="undergraduate">
                {Object.entries(stages).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              去向年份
              <input
                name="year"
                type="number"
                min="2023"
                max="2100"
                defaultValue={new Date().getFullYear()}
                required
              />
            </label>
          </div>
          <label>
            去向类型
            <select
              name="kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as DestinationInput["kind"])
              }
            >
              {Object.entries(destinationKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {kind === "study"
              ? "录取学校"
              : kind === "employment"
                ? "工作单位"
                : "去向说明"}
            <input name="organization" maxLength={120} required />
          </label>
          <label>
            {kind === "study"
              ? "专业 / 研究方向"
              : kind === "employment"
                ? "岗位 / 部门"
                : "补充信息"}
            <input name="detail" maxLength={120} />
          </label>
          <div className="form-pair">
            <label>
              省份 / 地区
              <select name="province" defaultValue="" required>
                <option value="" disabled>
                  请选择地区
                </option>
                {provinces.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              城市
              <input
                name="city"
                maxLength={60}
                placeholder="如：合肥；境外可写国家和城市"
                required
              />
            </label>
          </div>
          <p className="form-hint">
            境外去向会保留在公开列表中，暂不显示在国内地图上。
          </p>
          <label>
            给审核人的备注（不公开）
            <textarea
              name="note"
              maxLength={500}
              rows={3}
              placeholder="可说明更正原因，勿填写手机号等私人信息"
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="form-success">
              {message}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "正在提交…" : "提交审核"}
          </button>
        </fieldset>
      </form>
      <section className="submission-history" aria-label="我的提交">
        <h3>我的提交</h3>
        {historyError ? (
          <p role="alert">
            暂时无法读取提交记录。<button onClick={load}>重试</button>
          </p>
        ) : records.length ? (
          <ul>
            {records.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>
                    {students.find((s) => s.id === row.studentId)?.name} ·{" "}
                    {row.year} · {row.organization}
                  </strong>
                  <span className={"status-badge status-" + row.status}>
                    {statusNames[row.status]}
                  </span>
                </div>
                {row.rejectionReason && <p>退回原因：{row.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无提交记录。</p>
        )}
      </section>
    </>
  );
}

export default function DestinationForm({ students }: { students: Student[] }) {
  return (
    <>
      <EmailGate>
        {(email) => <FillForm students={students} email={email} key={email} />}
      </EmailGate>
      <p className="review-link">
        <a href="#review">管理员审核入口</a>
      </p>
    </>
  );
}
