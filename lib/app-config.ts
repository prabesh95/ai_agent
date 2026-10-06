export const APP_BRAND = {
  name: "The King's AI",
  mark: "K",
  tagline: "Your voice. Your ideas. Your AI.",
};

export type WorkspaceView = "home" | "chat";
export type ModuleId = WorkspaceView | "tasks" | "calendar" | "files" | "memory";

// Enable an entry and provide its route when that module exists.
// Home/Chat currently switch views without unmounting the conversation hook.
export const WORKSPACE_NAV: {
  id: ModuleId;
  label: string;
  icon: "home" | "chat" | "tasks" | "calendar" | "files" | "memory";
  enabled: boolean;
  href?: string;
}[] = [
  { id: "home", label: "Home", icon: "home", enabled: true },
  { id: "chat", label: "Chat", icon: "chat", enabled: true },
  { id: "tasks", label: "Tasks", icon: "tasks", enabled: false },
  { id: "calendar", label: "Calendar", icon: "calendar", enabled: false },
  { id: "files", label: "Files", icon: "files", enabled: false },
  { id: "memory", label: "Memory", icon: "memory", enabled: false },
];
