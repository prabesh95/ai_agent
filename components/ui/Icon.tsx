import type { CSSProperties } from "react";
export type IconName = "home" | "chat" | "tasks" | "calendar" | "files" | "memory" |
  "mic" | "send" | "stop" | "volume" | "wave" | "spark" | "arrow" | "trash" | "shield" | "chevron" | "warning";
const paths: Record<IconName, string[]> = {
  home: ["M3 10.5 12 3l9 7.5", "M5 9v11h5v-6h4v6h5V9"],
  chat: ["M21 11.5a8.4 8.4 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.5-5A8.5 8.5 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z", "M8 11h.01M12 11h.01M16 11h.01"],
  tasks: ["M21 12a9 9 0 1 1-4-7.5", "m8 11 3 3L21 4"],
  calendar: ["M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", "M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2"],
  files: ["M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"],
  memory: ["M12 4v16M8 4a3 3 0 0 0-5 3 4 4 0 0 0-1 7 4 4 0 0 0 6 5M16 4a3 3 0 0 1 5 3 4 4 0 0 1 1 7 4 4 0 0 1-6 5", "M7 8h2M15 8h2M6 14h3M15 14h3"],
  mic: ["M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6Z", "M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"],
  send: ["m22 2-7 20-4-9-9-4 20-7Z", "M22 2 11 13"],
  stop: ["M6 6h12v12H6Z"],
  volume: ["m11 4-5 4H3v8h3l5 4V4Z", "M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"],
  wave: ["M3 10v4M7 7v10M12 3v18M17 7v10M21 10v4"],
  spark: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"],
  arrow: ["M4 12h16m-6-6 6 6-6 6"],
  trash: ["M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"],
  shield: ["m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z", "m8 12 3 3 5-6"],
  chevron: ["m9 5 7 7-7 7"],
  warning: ["m12 3 10 18H2L12 3Z", "M12 9v5M12 17h.01"],
};
export function Icon({ name, size = 20, className = "", style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties;
}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" style={style}>
    {paths[name].map((path, index) => <path d={path} key={index} />)}
  </svg>;
}
