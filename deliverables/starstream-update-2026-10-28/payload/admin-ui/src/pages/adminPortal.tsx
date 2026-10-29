import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../api/auth";

import { useToast } from "../components/Toast";
import "./adminPortal.css";

export default function AdminPortal() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const toast = useToast();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(username.trim(), password, rememberMe);
      toast.push({ type: "ok", title: "Signed in", message: "Welcome back to Star Stream IPTV." });
      const to = (loc.state && loc.state.from) ? loc.state.from : "/dashboard";
      nav(to, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Sign-in failed");
      toast.push({ type: "error", title: "Sign-in failed", message: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ap-page">
      <div className="ap-layout">
        <header className="ap-header">
          <img
            className="ap-logo"
            src="/star-stream-logo.svg"
            alt="Star Stream IPTV Logo"
            width={80}
            height={80}
          />
          <h1 id="ap-heading" className="ap-heading">
            <span className="ap-brand-name">Star Stream <span className="ap-brand-iptv">IPTV</span></span>
          </h1>
          <p id="ap-description" className="ap-subheading">
            Sign in to access the Star Stream admin portal.
          </p>
        </header>

        <section className="ap-card" aria-labelledby="ap-heading" aria-describedby="ap-description">
        <form className="ap-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
          <div className="ap-field">
            <label htmlFor="ap-username" className="ap-label">
              USERNAME
            </label>
            <div className="ap-username">
              <svg className="ap-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
              </svg>
            <input
              id="ap-username"
              className="ap-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
            />
            </div>
          </div>

          <div className="ap-field">
            <label htmlFor="ap-password" className="ap-label">
              PASSWORD
            </label>
            <div className="ap-password">
              <input
                id="ap-password"
                className="ap-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="ap-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="ap-password"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  {showPassword ? (
                    <>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M3 8s3 6 9 6 9-6 9-6M5 11l-2 3m6-1-1 4m7-4 1 4m3-6 2 3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <label className="ap-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              disabled={busy}
            />
            <span>Keep me signed in for 30 days</span>
          </label>

          {err && (
            <div className="ap-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12.5" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{err}</span>
            </div>
          )}

          <button
            className="ap-submit"
            type="submit"
            disabled={busy || !username.trim() || !password}
          >
            <span>{busy ? "SIGNING IN…" : "SIGN IN"}</span>
          </button>
        </form>


        </section>
      </div>
    </main>
  );
}
