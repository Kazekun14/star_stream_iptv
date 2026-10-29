import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { logout, me } from "../api/auth";
import { useToast } from "./Toast";
import SidebarIcon from "./SidebarIcon";
import AccountMenu from "./AccountMenu";
import GlobalSearch from "./GlobalSearch";
import "./shell.css"; 

export default function Shell({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = React.useState<any>(null);
  const toast = useToast();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [mobile, setMobile] = React.useState(() => window.matchMedia("(max-width: 600px)").matches);
  const sidebarRef = React.useRef<HTMLElement>(null);
  const mobileToggleRef = React.useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = React.useState(() => window.matchMedia("(max-width: 980px)").matches);
  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const update = () => setCollapsed(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    if (window.matchMedia("(max-width: 980px)").matches) setCollapsed(true);
  }, [pathname]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await me();
        if (!alive) return;
        setAdmin(a);
      } catch {
        // session missing; route guard should handle
      }
    })();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    const update = (event: Event) => setAdmin((event as CustomEvent).detail);
    window.addEventListener("admin-account-updated", update);
    return () => window.removeEventListener("admin-account-updated", update);
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => { setMobile(media.matches); setCollapsed(true); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    if (!mobile || collapsed) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>(".sidebar-toggle")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCollapsed(true); return; }
      if (e.key !== "Tab") return;
      const items = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", onKey); mobileToggleRef.current?.focus(); };
  }, [mobile, collapsed]);

  async function onLogout() {
    try {
      await logout();
      toast.push({ type: "ok", title: "Signed out", message: "Your session has been closed." });
      nav("/portal", { replace: true });
    } catch (e: any) {
      toast.push({ type: "error", title: "Sign-out failed", message: e?.message || String(e) });
    }
  }

  return (
    <div className={`shell${collapsed ? " shell--collapsed" : ""}`}>
      <aside ref={sidebarRef} id="admin-navigation" className="sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <a
            href="/dashboard"
            className="brand sidebar-brand"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/dashboard";
            }}
            title="Go to Dashboard"
          >
            <img className="sidebar-logo" src="/star-stream-logo.svg" alt="Star Stream logo" width={40} height={40} />
            <span className="sidebar-copy">Star Stream <span className="sidebar-brand-iptv">IPTV</span></span>
          </a>
          <button className="sidebar-toggle" type="button" aria-controls="admin-navigation" aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(value => !value)}>
            <SidebarIcon name={collapsed ? "menu" : "collapse"} />
          </button>
        </div>
        <hr className="sidebar-header-divider" />
        <nav className="nav" aria-label="Pages">
          <div className="sidebar-menu-label sidebar-copy">Menu</div>
          {([
            ["/dashboard", "Dashboard", "dashboard"],
            ["/categories", "Categories", "category"],
            ["/packages", "Packages", "package"],
            ["/channels", "Channels", "channels"],
            ["/package-channels", "Package Channels", "assign"],
            ["/users", "Users", "users"],
            ["/settings", "Settings", "settings"],
          ] as const).map(([to, label, icon]) => (
            <React.Fragment key={to}>
              <NavLink to={to} end aria-label={label} title={collapsed ? label : undefined} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <SidebarIcon name={icon} />
                <span className="sidebar-copy">{label}</span>
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-logout signout-card" type="button" onClick={onLogout} aria-label="Sign out" title={collapsed ? "Sign out" : undefined}>
            <span className="signout-card-icon"><SidebarIcon name="logout" /></span>
            <span className="signout-card-copy sidebar-copy">
              <strong>Sign out</strong>

            </span>
          </button>
        </div>
      </aside>
      {mobile && !collapsed && <div className="mobile-nav-backdrop" onClick={() => setCollapsed(true)} aria-hidden="true" />}
      <main>
        <div className="topbar">
          <div className="row">
            <button ref={mobileToggleRef} className="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={!collapsed} onClick={() => setCollapsed(false)}><SidebarIcon name="menu" /></button>
            <GlobalSearch />
            <div className="spacer" />
            <div className="topbar-actions">
              <div className="iptv-identity">
                <span className="iptv-identity-mark">
                  <img className="iptv-identity-logo" src="/cebu-cable-internet.png" alt="" width={68} height={35} />
                </span>
                <span className="iptv-identity-copy">
                  <span className="iptv-identity-label">IPTV management for</span>
                  <span className="iptv-identity-name">Cebu Cable Internet</span>
                </span>
              </div>
              <div className="topbar-account">
                <AccountMenu admin={admin} collapsed={false} onSignOut={onLogout} />
              </div>
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
