const artwork = {
  update: <path d="m14 5 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16z" />,
  teachers: (
    <>
      <path d="M3 4.5h6a4 4 0 0 1 3 1.2 4 4 0 0 1 3-1.2h6v15h-6a4 4 0 0 0-3 1.2 4 4 0 0 0-3-1.2H3z" />
      <path d="M12 5.7v15M6 9h3M15 9h3M6 13h3M15 13h3" />
    </>
  ),
  students: (
    <>
      <path d="m2 9 10-5 10 5-10 5zM6 11v6c3 3 9 3 12 0v-6M22 9v7" />
    </>
  ),
  location: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  play: <path d="m9 6 9 6-9 6z" />,
  scroll: <path d="M4 12h16m-4-4 4 4-4 4M8 8l-4 4 4 4" />,
};

interface IconProps {
  name: keyof typeof artwork;
  className?: string;
}

export default function Icon({ name, className = "" }: IconProps) {
  return (
    <svg
      className={"ui-icon " + className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[name]}
    </svg>
  );
}
