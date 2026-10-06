import type { ReactNode } from "react";
import type { ModuleId, WorkspaceView } from "../../lib/app-config";
import { APP_BRAND, WORKSPACE_NAV } from "../../lib/app-config";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { Icon } from "../ui/Icon";

// The shell deliberately owns no conversation state. Future route layouts can
// wrap wide Calendar/Tasks/Files/Memory workspaces with this same component.
export function AppShell({
  children,
  activeView,
  onNavigate,
  title,
  description,
}: {
  children: ReactNode;
  activeView: ModuleId;
  onNavigate?: (view: WorkspaceView) => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <WorkspaceSidebar activeView={activeView} onNavigate={onNavigate} />
      <main className="workspace-main" id="workspace-main">
        <header className="workspace-header">
          <div>
            <div className="breadcrumb eyebrow">
              Workspace <Icon name="chevron" size={12} />
              <span>
                {WORKSPACE_NAV.find((item) => item.id === activeView)?.label}
              </span>
            </div>
            <h1>
              {title ??
                (activeView === "home"
                  ? "Welcome to your space."
                  : activeView === "chat"
                    ? "Let’s talk."
                    : WORKSPACE_NAV.find((item) => item.id === activeView)
                        ?.label)}
            </h1>
            <p>{description ?? APP_BRAND.tagline}</p>
          </div>
          <div className="workspace-header-meta">
            <span className="badge badge-neutral">
              <span className="status-dot" /> Local workspace
            </span>
            <div
              className="profile-avatar"
              title={APP_BRAND.name}
              aria-label={APP_BRAND.name}
            >
              {APP_BRAND.mark}
            </div>
          </div>
        </header>
        {children}
        <footer className="workspace-footer">
          <span>{APP_BRAND.name}</span>
          <span>THINK · SPEAK · CREATE</span>
        </footer>
      </main>
    </div>
  );
}
