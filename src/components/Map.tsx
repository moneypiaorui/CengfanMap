import { useEffect, useId, useMemo, useState } from "react";
import china from "../data/maps/china.json";
import type { Student } from "../../shared/directory";
import { colorForCount, projectFeatures } from "../lib/map";
import type { MapFeature } from "../lib/map";

const nationalFeatures = china.features as unknown as MapFeature[];
const provinceCache = new globalThis.Map<string, MapFeature[]>();
const loaders = import.meta.glob<{ default: { features: MapFeature[] } }>([
  "../data/maps/*.json",
  "!../data/maps/china.json",
]);

interface MapProps {
  province: string;
  city: string;
  students: Student[];
  onProvince: (province: string) => void;
  onCity: (city: string) => void;
}

interface LoadedMap {
  key: string;
  features?: MapFeature[];
  error?: boolean;
}

export default function Map({
  province,
  city,
  students,
  onProvince,
  onCity,
}: MapProps) {
  const [loaded, setLoaded] = useState<LoadedMap | null>(null);
  const [hover, setHover] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipId = useId();
  const instructionsId = useId();
  const candidate = nationalFeatures.find(
    (feature) => feature.properties.name === province,
  )?.properties.filename;
  const filename =
    candidate && loaders["../data/maps/" + candidate + ".json"]
      ? candidate
      : undefined;

  useEffect(() => {
    if (!filename || provinceCache.has(filename)) return;
    let active = true;
    loaders["../data/maps/" + filename + ".json"]()
      .then((module) => {
        provinceCache.set(filename, module.default.features);
        if (active)
          setLoaded({ key: filename, features: module.default.features });
      })
      .catch(() => {
        if (active) setLoaded({ key: filename, error: true });
      });
    return () => {
      active = false;
    };
  }, [filename]);

  const cachedFeatures = filename ? provinceCache.get(filename) : undefined;
  const features =
    cachedFeatures ??
    (filename && loaded?.key === filename && loaded.features
      ? loaded.features
      : nationalFeatures);
  const local = features !== nationalFeatures;
  const geometry = useMemo(() => projectFeatures(features), [features]);
  const peopleByRegion = useMemo(() => {
    const groups = new globalThis.Map<string, Student[]>();
    for (const student of students) {
      if (local && student.province !== province) continue;
      const name = local ? student.city : student.province;
      const group = groups.get(name) ?? [];
      group.push(student);
      groups.set(name, group);
    }
    return groups;
  }, [students, local, province]);

  function activate(name: string) {
    setHover(null);
    if (local) onCity(name);
    else onProvince(name);
  }

  function showTooltip(name: string, x: number, y: number) {
    setHover({
      name,
      x: Math.max(12, Math.min(x + 16, window.innerWidth - 342)),
      y: Math.max(12, Math.min(y + 16, window.innerHeight - 270)),
    });
  }

  if (
    filename &&
    !cachedFeatures &&
    (loaded?.key !== filename || !loaded.features)
  ) {
    return (
      <div className="map-stage map-loading" role="status">
        {loaded?.key === filename && loaded.error
          ? "地图暂时无法加载，请返回全国后重试。"
          : "正在加载" + province + "城市地图…"}
      </div>
    );
  }

  const hoveredPeople = hover ? (peopleByRegion.get(hover.name) ?? []) : [];
  return (
    <div className={"map-stage" + (local ? " map-stage--local" : "")}>
      <p className="sr-only" id={instructionsId}>
        使用 Tab 键选择地区，按回车或空格展开地图或查看录取信息。
      </p>
      <svg
        key={local ? filename : "china"}
        viewBox="0 0 850 570"
        role="group"
        aria-label={local ? province + "城市地图" : "全国省份地图"}
        aria-describedby={instructionsId}
      >
        {geometry.map((feature) => {
          const count = peopleByRegion.get(feature.name)?.length ?? 0;
          return (
            <path
              key={feature.id}
              className={
                "map-region" +
                (local && city === feature.name ? " map-region--selected" : "")
              }
              d={feature.path}
              fill={colorForCount(count)}
              fillRule="evenodd"
              vectorEffect="non-scaling-stroke"
              role="button"
              tabIndex={0}
              aria-label={feature.name + "，" + count + "位同学"}
              aria-describedby={
                hover?.name === feature.name ? tooltipId : undefined
              }
              onClick={() => activate(feature.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(feature.name);
                }
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch")
                  showTooltip(feature.name, event.clientX, event.clientY);
              }}
              onPointerLeave={() => setHover(null)}
              onFocus={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                showTooltip(
                  feature.name,
                  box.x + box.width / 2,
                  box.y + box.height / 2,
                );
              }}
              onBlur={() => setHover(null)}
            />
          );
        })}
        {local &&
          geometry.map((feature) => (
            <text
              key={feature.id}
              className="map-label"
              x={feature.x}
              y={feature.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {feature.name}
            </text>
          ))}
      </svg>
      {province && !filename && (
        <p className="map-notice" role="status">
          {province}暂无城市地图，当前仍展示全国地图。
        </p>
      )}
      {hover && (
        <div
          key={hover.name}
          id={tooltipId}
          role="tooltip"
          className="map-tooltip"
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>
            {hover.name}：{hoveredPeople.length} 人
          </strong>
          {hoveredPeople.length ? (
            <ul>
              {hoveredPeople.slice(0, 8).map((student) => (
                <li key={student.id}>
                  <b>{student.name}</b>
                  <span>{student.city}</span>
                  <span>{student.school}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>暂无同学录取记录</p>
          )}
          {hoveredPeople.length > 8 && (
            <p>另有 {hoveredPeople.length - 8} 位同学，可在录取总览中查看。</p>
          )}
        </div>
      )}
      <a
        className="map-attribution"
        href={china.copyrightUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {china.copyrightShort}
      </a>
    </div>
  );
}
