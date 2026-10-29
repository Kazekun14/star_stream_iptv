import React from "react";
import { me, updateAccount, listAdminSessions, revokeOtherSessions, type AdminSession } from "../api/auth";
import type { AdminMe } from "../api/types";
import { useToast } from "../components/Toast";
import AppearanceSettings from "../components/AppearanceSettings";
import "./settings.css";

type Tab = "account" | "security" | "sessions" | "appearance";
const tabs: { id: Tab; label: string; description: string }[] = [
  { id: "account", label: "Account", description: "Profile and sign-in details" },
  { id: "security", label: "Security", description: "Password and account protection" },
  { id: "sessions", label: "Sessions", description: "Manage active sign-ins" },
  { id: "appearance", label: "Appearance", description: "Dark and light themes" },
];
export default function SettingsPage() {
  const toast = useToast();
  const [tab, setTab] = React.useState<Tab>("account");
  const [admin, setAdmin] = React.useState<AdminMe | null>(null);
  const [profile, setProfile] = React.useState({ username: "", full_name: "", email: "" });
  const [editing, setEditing] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [sessions, setSessions] = React.useState<AdminSession[]>([]);
  function apply(value: AdminMe) { setAdmin(value); setProfile({ username: value.username, full_name: value.full_name || "", email: value.email || "" }); }
  async function load() {
    setLoading(true); setError("");
    try { apply(await me()); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);
  async function loadSessions() {
    setSessionsLoading(true); setError("");
    try { setSessions(await listAdminSessions()); } catch (e: any) { setError(e.message); } finally { setSessionsLoading(false); }
  }
  function changeTab(next: Tab) {
    if (busy || next === tab) return;
    if ((editing || current || password || confirm) && !window.confirm("Discard unsaved changes and switch tabs?")) return;
    setTab(next); setEditing(false); setCurrent(""); setPassword(""); setConfirm(""); setError(""); setSuccess("");
    if (admin) apply(admin);
    if (next === "sessions") loadSessions();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!admin) return;
    setError(""); setSuccess("");
    if (tab === "security" && password !== confirm) { setError("New passwords do not match."); return; }
    if (tab === "security" && (new TextEncoder().encode(password).length > 72 || password.length < 12)) { setError("Use at least 12 characters and no more than 72 UTF-8 bytes."); return; }
    setBusy(true);
    try {
      if (tab === "sessions") {
        await revokeOtherSessions(current);
        await loadSessions();
        const msg = "Other sessions have been signed out.";
        setSuccess(msg);
        toast.push({ type: "ok", title: "Sessions signed out", message: msg });
      } else {
        const fields = tab === "account" ? profile : { username: admin.username, full_name: admin.full_name || "", email: admin.email || "" };
        apply(await updateAccount({ ...fields, current_password: current, ...(tab === "security" ? { new_password: password } : {}) }));
        const msg = tab === "security" ? "Password updated. Other sessions have been signed out." : "Account details updated.";
        setSuccess(msg);
        toast.push({ type: "ok", title: tab === "security" ? "Password updated" : "Account updated", message: msg });
      }
      setCurrent(""); setPassword(""); setConfirm(""); setEditing(false);
    } catch (e: any) {
      const msg = e?.message || "Unable to save settings.";
      setError(msg);
      toast.push({ type: "error", title: "Update failed", message: msg });
    } finally { setBusy(false); }
  }
  function date(value: string) { const d = new Date(value.replace(" ", "T") + "Z"); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); }
  const dirty = !!admin && (profile.username !== admin.username || profile.full_name !== (admin.full_name || "") || profile.email !== (admin.email || ""));
  return <div className="container settings-page">
    <header className="settings-header"><h1 className="h1">Settings</h1><p>Manage your account, security, active sessions, and website appearance.</p></header>
    <div className="settings-layout">
      <nav className="settings-tabs" role="tablist" aria-label="Settings sections">{tabs.map((item, index) => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls="settings-panel" tabIndex={tab === item.id ? 0 : -1} disabled={busy} onClick={() => changeTab(item.id)} onKeyDown={(e) => {
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault(); const target = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : tabs.length - 1)) % tabs.length;
        document.getElementById(`tab-${tabs[target].id}`)?.focus();
      }}><strong>{item.label}</strong><span>{item.description}</span></button>)}</nav>
      <section className="settings-panel" id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "appearance" ? <AppearanceSettings /> : loading ? <p role="status">Loading your account...</p> : !admin ? <><p role="alert">{error}</p><button className="btn" onClick={load}>Try again</button></> : <>
          <div className="settings-panel-header"><div><h2>{tab === "account" ? "Account details" : tab === "security" ? "Change password" : "Active sessions"}</h2><p>{tab === "account" ? "Keep your profile and sign-in information up to date." : tab === "security" ? "Choose a unique password with at least 12 characters." : "Review where you are signed in. Times use your device timezone."}</p></div>{tab === "account" && !editing && <button className="btn" onClick={() => { setEditing(true); setSuccess(""); }}>Edit account</button>}{tab === "sessions" && <button className="btn" disabled={busy || sessionsLoading} onClick={loadSessions}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 4v6h-6M4 20v-6h6"/><path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16"/></svg>Refresh</button>}</div>
          {error && <p className="settings-notice is-error" role="alert"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{error}</span></p>}{success && <p className="settings-notice" role="status"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>{success}</span></p>}
          <form onSubmit={save}>
            {tab === "account" && <><div className="settings-identity"><span aria-hidden="true">{admin.username.slice(0, 2).toUpperCase()}</span><div><strong>{admin.full_name || admin.username}</strong><small>Administrator &middot; @{admin.username}</small></div></div><div className="settings-fields">{([["username", "Username", "text", 64], ["full_name", "Full name", "text", 255], ["email", "Email address", "email", 255]] as const).map(([key, label, type, max]) => <label key={key}><span>{label}{key === "username" ? " *" : ""}</span><input className="input" type={type} value={profile[key]} required={key === "username"} maxLength={max} readOnly={!editing} disabled={busy} autoComplete={key === "username" ? "username" : key === "email" ? "email" : "name"} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} placeholder="Not set" /></label>)}</div>{editing && <p className="settings-help">Your username is used to sign in. Enter your current password below to authorize these changes.</p>}</>}
            {tab === "security" && <div className="settings-fields"><label><span>New password</span><input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={72} required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} /></label><label><span>Confirm new password</span><input className="input" type="password" autoComplete="new-password" required disabled={busy} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label></div>}
            {tab === "sessions" && <div className="settings-sessions">{sessionsLoading ? <p role="status">Loading sessions...</p> : sessions.map((session, index) => <article key={index}><div><strong>{Number(session.is_current) ? "This session" : "Other session"}</strong><span>{session.ip_address || "Unknown IP"}</span></div><p>{session.user_agent || "Unknown device"}</p><small>Last active: {date(session.last_seen_at)}<br/>Expires: {date(session.expires_at)}</small></article>)}</div>}
            {(editing || tab !== "account") && <><label className="settings-password"><span>Current password</span><input className="input" type="password" autoComplete="current-password" required disabled={busy} value={current} onChange={(e) => setCurrent(e.target.value)} /></label><p className="settings-help">{tab === "security" ? "Updating your password signs out all other sessions. This session stays active." : tab === "sessions" ? "Sign out all other devices while keeping this session active." : "Your password is used only to verify this change."}</p><footer className="settings-actions">{editing && <button className="btn" type="button" disabled={busy} onClick={() => { apply(admin); setEditing(false); setCurrent(""); setError(""); }}>Cancel</button>}<button className="btn settings-save" type="submit" disabled={busy || !current || (tab === "account" && !dirty) || (tab === "sessions" && (sessionsLoading || !sessions.some(s => !Number(s.is_current))))}>{busy ? "Saving..." : tab === "account" ? "Save changes" : tab === "security" ? "Update password" : "Sign out other sessions"}</button></footer></>}
          </form>
        </>}
      </section>
    </div>
  </div>;
}
