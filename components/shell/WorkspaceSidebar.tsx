import Link from "next/link";
import { APP_BRAND, WORKSPACE_NAV } from "../../lib/app-config";
import type { ModuleId, WorkspaceView } from "../../lib/app-config";
import { Icon } from "../ui/Icon";

export function WorkspaceSidebar({ activeView, onNavigate }: {
  activeView: ModuleId; onNavigate?: (view: WorkspaceView) => void;
}) {
  return <aside className="workspace-sidebar" aria-label="Workspace sidebar">
    <div className="sidebar-brand">
      <div className="brand-emblem" aria-hidden="true">{APP_BRAND.mark}</div>
      <div><span className="brand-name">{APP_BRAND.name}</span><span className="brand-caption">PERSONAL INTELLIGENCE</span></div>
    </div>
    <div className="sidebar-section-label eyebrow">Workspace</div>
    <nav className="workspace-nav" aria-label="Main navigation">
      {WORKSPACE_NAV.map((item) => {
        const className = `nav-item ${activeView === item.id ? "is-active" : ""}`;
        const content = <><Icon name={item.icon} /><span>{item.label}</span>
          {activeView === item.id && <span className="nav-active-dot" aria-hidden="true" />}</>;
        if (item.href && item.enabled) return <Link href={item.href} className={className} aria-current={activeView === item.id ? "page" : undefined} key={item.id}>{content}</Link>;
        return <button className={className} key={item.id} type="button"
          disabled={!item.enabled} aria-current={activeView === item.id ? "page" : undefined}
          aria-label={item.label}
          onClick={() => { if (item.id === "home" || item.id === "chat") onNavigate?.(item.id); }}>
          {content}
        </button>;
      })}
    </nav>
    <div className="sidebar-footer">
      <div className="sidebar-note"><Icon name="shield" size={18} /><div><strong>Made for your space</strong><span>A personal AI workspace</span></div></div>
      <div className="sidebar-signature"><span className="status-dot" /> LOCAL INTERFACE <span className="signature-line" /></div>
    </div>
  </aside>;
}
