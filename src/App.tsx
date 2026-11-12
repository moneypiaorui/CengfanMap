import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import Dialog from "./components/Dialog";
import Map from "./components/Map";
import SideNav from "./components/SideNav";
import type { Panel } from "./components/SideNav";
import StudentDirectory from "./components/StudentDirectory";
import Teachers from "./components/Teachers";
import Icon from "./components/Icon";
import DirectoryStatus from "./components/DirectoryStatus";
import useDirectoryData from "./hooks/useDirectoryData";
import { currentStudents } from "./lib/destinations";

const DestinationForm = lazy(() => import("./components/DestinationForm"));
const ReviewPage = lazy(() => import("./components/ReviewPage"));

function MapApp() {
  const directory = useDirectoryData();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [closing, setClosing] = useState(false);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [latest, setLatest] = useState(false);
  const [directoryScope, setDirectoryScope] = useState({
    province: "",
    city: "",
  });
  const imageBase = import.meta.env.BASE_URL + "images/";
  const requestClose = useCallback(() => setClosing(true), []);
  const finishClose = useCallback(() => {
    setPanel(null);
    setClosing(false);
  }, []);

  function selectProvince(next: string) {
    setProvince(next);
    setCity("");
  }

  function selectPanel(next: Panel) {
    if (panel === next) {
      setClosing(!closing);
      return;
    }
    if (next === "students") setDirectoryScope({ province: "", city: "" });
    setClosing(false);
    setPanel(next);
  }

  function selectCity(next: string) {
    setCity(next);
    setDirectoryScope({ province, city: next });
    setClosing(false);
    setPanel("students");
  }

  return (
    <main className="map-page">
      <div aria-hidden={panel ? true : undefined}>
        <img
          className="school-name"
          src={imageBase + "menpai.png"}
          alt="合肥一中"
          width="468"
          height="110"
        />
        <header className="legacy-heading">
          <h1>2023届35班蹭饭地图</h1>
          <p>
            <Icon name="location" />
            <span>
              {province || "中国"}
              {city ? " · " + city : ""}
            </span>
          </p>
        </header>
        {!province && (
          <div className="school-emblems">
            <img
              className="school-emblem"
              src={imageBase + "yizhong.png"}
              alt="合肥一中校徽"
              width="220"
              height="220"
            />
            <img
              className="class-emblem"
              src={imageBase + "banhui.png"}
              alt="2023届35班班徽"
              width="220"
              height="220"
            />
          </div>
        )}
        <section id="map" aria-label="同学分布">
          {province && (
            <button
              className="back-to-china"
              onClick={() => selectProvince("")}
            >
              <Icon name="back" /> 返回全国
            </button>
          )}
          {directory.status === "ready" ? (
            <Map
              province={province}
              city={city}
              students={
                latest
                  ? currentStudents(
                      directory.data.students,
                      directory.data.destinations,
                    )
                  : directory.data.students
              }
              onProvince={selectProvince}
              onCity={selectCity}
            />
          ) : (
            <div className="directory-loading-stage">
              <DirectoryStatus
                loading={directory.status === "loading"}
                onRetry={directory.retry}
              />
            </div>
          )}
          <div
            className="map-legend"
            aria-label="同学人数图例：颜色越深，人数越多"
          >
            <div className="map-mode" role="group" aria-label="地图数据">
              <button
                aria-pressed={!latest}
                onClick={() => {
                  setLatest(false);
                  selectProvince("");
                }}
              >
                本科录取
              </button>
              <button
                aria-pressed={latest}
                onClick={() => {
                  setLatest(true);
                  selectProvince("");
                }}
              >
                最新去向
              </button>
            </div>
            {latest && (
              <p className="map-source-note">未更新的同学仍显示本科位置</p>
            )}
            <div className="legend-gradient" />
            <div className="legend-ticks">
              {[0, 2, 4, 6, 8, 10].map((count) => (
                <span key={count}>{count}</span>
              ))}
            </div>
          </div>
          <p className="map-instruction">
            {province ? (
              "点击城市查看录取信息"
            ) : (
              <>
                <span className="pointer-hint">
                  悬停查看同学，点击省份查看城市
                </span>
                <span className="touch-hint">轻触省份，查看城市与同学</span>
              </>
            )}
          </p>
        </section>
        <SideNav activePanel={panel} onSelect={selectPanel} />
      </div>
      {panel && (
        <Dialog
          title={
            panel === "teachers"
              ? "任课老师"
              : panel === "update"
                ? "更新去向"
                : "录取总览"
          }
          panel={panel}
          closing={closing}
          onClose={requestClose}
          onExited={finishClose}
          navigation={<SideNav activePanel={panel} onSelect={selectPanel} />}
        >
          {directory.status !== "ready" ? (
            <DirectoryStatus
              loading={directory.status === "loading"}
              onRetry={directory.retry}
            />
          ) : panel === "teachers" ? (
            <Teachers teachers={directory.data.teachers} />
          ) : panel === "update" ? (
            <Suspense fallback={<p role="status">正在准备填写入口…</p>}>
              <DestinationForm students={directory.data.students} />
            </Suspense>
          ) : (
            <StudentDirectory
              students={directory.data.students}
              destinations={directory.data.destinations}
              initialLatest={latest}
              key={directoryScope.province + "-" + directoryScope.city}
              initialProvince={directoryScope.province}
              initialCity={directoryScope.city}
            />
          )}
        </Dialog>
      )}
    </main>
  );
}

export default function App() {
  const [review, setReview] = useState(window.location.hash === "#review");
  useEffect(() => {
    const change = () => setReview(window.location.hash === "#review");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return review ? (
    <Suspense fallback={<p role="status">正在准备审核入口…</p>}>
      <ReviewPage />
    </Suspense>
  ) : (
    <MapApp />
  );
}
