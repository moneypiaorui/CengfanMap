import Icon from "./Icon";

export type Panel = "teachers" | "students";

interface SideNavProps {
  activePanel: Panel | null;
  onSelect: (panel: Panel) => void;
}

export default function SideNav({ activePanel, onSelect }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label="快捷导航">
      <button
        aria-haspopup="dialog"
        aria-pressed={activePanel === "teachers"}
        onClick={() => onSelect("teachers")}
      >
        <Icon name="teachers" />
        <span>任课老师</span>
      </button>
      <button
        aria-haspopup="dialog"
        aria-pressed={activePanel === "students"}
        onClick={() => onSelect("students")}
      >
        <Icon name="students" />
        <span>录取总览</span>
      </button>
    </nav>
  );
}
