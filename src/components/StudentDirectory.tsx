import { useRef, useState } from "react";
import { filterStudents, getProvinceNames } from "../lib/students";
import type { Student } from "../../shared/directory";
import { stages, destinationKinds } from "../../shared/destinations";
import type { Destination } from "../../shared/destinations";
import Icon from "./Icon";

interface StudentDirectoryProps {
  students: Student[];
  destinations: Destination[];
  initialLatest: boolean;
  initialProvince: string;
  initialCity: string;
}

export default function StudentDirectory({
  students,
  destinations,
  initialLatest,
  initialProvince,
  initialCity,
}: StudentDirectoryProps) {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState(initialLatest);
  const [province, setProvince] = useState(initialProvince);
  const [city, setCity] = useState(initialCity);
  const searchRef = useRef<HTMLInputElement>(null);
  const studentsById = new Map(
    students.map((student) => [student.id, student]),
  );
  const destinationsById = new Map(
    destinations.map((destination) => [destination.id, destination]),
  );
  const records = history
    ? destinations.map((destination) => ({
        ...studentsById.get(destination.studentId)!,
        id: destination.id,
        school: destination.organization,
        major: destination.detail,
        province: destination.province,
        city: destination.city,
      }))
    : students;
  const provinceNames = getProvinceNames(records);
  const filtered = filterStudents(records, query, province, city);
  const hasFilters = Boolean(query || province || city);

  function clearFilters() {
    setQuery("");
    setProvince("");
    setCity("");
    searchRef.current?.focus();
  }

  return (
    <div className="student-directory">
      <div className="directory-modes" role="group" aria-label="去向记录">
        <button aria-pressed={!history} onClick={() => setHistory(false)}>
          本科录取
        </button>
        <button aria-pressed={history} onClick={() => setHistory(true)}>
          后续去向
        </button>
      </div>
      <div
        className="directory-filters"
        role="search"
        aria-label="搜索与筛选同学"
      >
        <div className="search-field">
          <label className="search-input-label">
            <span className="sr-only">搜索同学</span>
            <Icon name="search" className="search-icon" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                history
                  ? "搜索姓名、单位、城市、专业或岗位"
                  : "搜索姓名、学校、城市、专业"
              }
            />
          </label>
          {query && (
            <button
              type="button"
              className="clear-search"
              aria-label="清空搜索"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <label className="province-filter">
          <span className="sr-only">筛选省份</span>
          <select
            value={province}
            onChange={(event) => {
              setProvince(event.target.value);
              setCity("");
            }}
          >
            <option value="">全部省份</option>
            {provinceNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="directory-summary">
        <p role="status">
          {city || province || "全部同学"} · 共 {filtered.length}{" "}
          {history ? "条记录" : "人"}
        </p>
        {hasFilters && (
          <button className="clear-filters" onClick={clearFilters}>
            清除筛选
          </button>
        )}
      </div>
      {filtered.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="同学录取信息，可横向滚动"
        >
          <table className="students-table">
            <caption className="sr-only">合肥一中2023届35班录取信息</caption>
            <thead>
              <tr>
                <th scope="col">姓名</th>
                {history && <th scope="col">阶段 / 年份</th>}
                <th scope="col">{history ? "去向 / 学校或单位" : "学校"}</th>
                <th scope="col">城市</th>
                <th scope="col">省份</th>
                <th scope="col">{history ? "专业 / 岗位" : "专业"}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => {
                const destination = destinationsById.get(student.id);
                return (
                  <tr className="student-row" key={student.id}>
                    <th scope="row">{student.name}</th>
                    {history && destination && (
                      <td>
                        {stages[destination.stage]}
                        <br />
                        {destination.year}
                      </td>
                    )}
                    <td>
                      {history && destination && (
                        <span className="destination-kind">
                          {destinationKinds[destination.kind]}
                        </span>
                      )}
                      {student.school}
                    </td>
                    <td>{student.city}</td>
                    <td>{student.province}</td>
                    <td>
                      {student.major === "待补充" ? (
                        <span className="muted">待补充</span>
                      ) : (
                        student.major
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-results">
          <h3>
            {history && !destinations.length
              ? "还没有公开的后续去向"
              : "还没有找到同学"}
          </h3>
          <p>
            {history && !destinations.length
              ? "通过右侧“更新去向”填写，审核通过后会展示在这里。"
              : "试试其他关键词，或清除省份、城市筛选。"}
          </p>
          <button onClick={clearFilters}>查看全部同学</button>
        </div>
      )}
      <p className="table-hint">
        <Icon name="scroll" />
        左右滑动查看完整信息，姓名列会保留。
      </p>
    </div>
  );
}
