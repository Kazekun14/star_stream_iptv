import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { me } from "../api/auth";

type AuthState =
  | { status: "loading" }
  | { status: "authed" }
  | { status: "anon" };

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({ status: "loading" });
  const loc = useLocation();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await me();
        if (!alive) return;
        setState({ status: "authed" });
      } catch {
        if (!alive) return;
        setState({ status: "anon" });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.status === "loading") {
    return (
      <main className="auth-gate-screen" aria-busy="true" aria-live="polite">
        <div className="auth-gate-card" role="status">
          <div className="auth-gate-logo-wrap">
            <img
              className="auth-gate-logo"
              src="/star-stream-logo.svg"
              alt=""
              width={44}
              height={44}
            />
            <span className="auth-gate-ring" aria-hidden="true" />
          </div>
          <div className="auth-gate-brand">
            Star Stream <span>IPTV</span>
          </div>
          <div className="auth-gate-status">
            <span className="auth-gate-dot" aria-hidden="true" />
            <span>Checking session…</span>
          </div>
        </div>
      </main>
    );
  }
  if (state.status === "anon") return <Navigate to="/portal" replace state={{ from: loc.pathname + loc.search + loc.hash }} />;
  return <>{children}</>;
}
