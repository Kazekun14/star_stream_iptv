import React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { AdminMe } from "../api/types";
import SidebarIcon from "./SidebarIcon";

export default function AccountMenu({ admin, collapsed, onSignOut }: { admin: AdminMe | null; collapsed: boolean; onSignOut: () => Promise<void> }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const dateLabel = now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const [position, setPosition] = React.useState({ left: 12, top: 72, width: 248 });
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);

  React.useEffect(() => { setOpen(false); }, [collapsed]);
  React.useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open, close]);

  function toggle() {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(rect.width < 160 ? 248 : rect.width, window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: rect.bottom + 8,
        width,
      });
    }
    setOpen(value => !value);
  }

  return <>
    <button ref={trigger} className="account-trigger" type="button" onClick={toggle} disabled={!admin} aria-expanded={open} aria-controls="account-options" aria-label={admin ? `Account options for ${admin.username}` : "Loading account"} title={collapsed ? admin?.username : undefined}>
      <span className="account-avatar" aria-hidden="true">{admin?.username.slice(0, 1).toUpperCase() || "?"}</span>
      {!collapsed && <>
        <span className="account-identity">
          <span className="account-name-row">
            <strong title={admin?.username}>{admin?.username || "Loading account…"}</strong>
          </span>
          <time className="account-clock" dateTime={now.toISOString()}>
            <span>{dateLabel}</span><span className="account-clock-divider" aria-hidden="true">/</span><span className="account-clock-time">{timeLabel}</span>
          </time>
        </span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </>}
    </button>
    {open && createPortal(<div ref={panel} id="account-options" className="account-options" style={position} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setOpen(false);
    }}>
      <button type="button" onClick={() => { setOpen(false); navigate("/settings"); }}><SidebarIcon name="settings" />Settings</button>
      <button type="button" className="account-signout" disabled={busy} onClick={async () => { setBusy(true); try { await onSignOut(); } finally { setBusy(false); setOpen(false); } }}><SidebarIcon name="logout" />{busy ? "Signing out…" : "Sign out"}</button>
    </div>, document.body)}
  </>;
}
