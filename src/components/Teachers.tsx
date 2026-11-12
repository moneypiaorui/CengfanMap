import type { Teacher } from "../data";
import Icon from "./Icon";

export default function Teachers({ teachers }: { teachers: Teacher[] }) {
  return (
    <div className="teacher-grid">
      {teachers.map((teacher) => {
        const portrait = teacher.image ? (
          <img
            src={import.meta.env.BASE_URL + "images/" + teacher.image}
            alt={teacher.name + "老师"}
            width="125"
            height="130"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="teacher-placeholder"
            role="img"
            aria-label={teacher.name + "老师暂无照片"}
          >
            <span aria-hidden="true">{teacher.name.slice(0, 1)}</span>
          </div>
        );
        return (
          <article className="teacher-card" key={teacher.id}>
            {teacher.videoUrl ? (
              <a
                href={teacher.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={"观看" + teacher.name + "老师的视频（新窗口）"}
              >
                {portrait}
                <span className="portrait-video-indicator">
                  <Icon name="play" />
                </span>
              </a>
            ) : (
              portrait
            )}
            <p className="teacher-meta">
              {teacher.subject}
              <span>{teacher.nickname}</span>
            </p>
            <h3>{teacher.name}</h3>
          </article>
        );
      })}
    </div>
  );
}
