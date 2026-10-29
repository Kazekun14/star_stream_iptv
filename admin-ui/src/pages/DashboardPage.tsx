// src/pages/DashboardPage.tsx
import React from "react";
import { health } from "../api/health";
import { getDashboardMetrics, type DashboardMetrics } from "../api/dashboard";
import { fmtDateTime } from "../utils/date";
import PackageBarChart from "../components/PackageBarChart";
import "./dashboard.css";

export default function DashboardPage() {
  const [h, setH] = React.useState<any>(null);
  const [m, setM] = React.useState<DashboardMetrics | null>(null);

  const [loadingHealth, setLoadingHealth] = React.useState(true);
  const [loadingMetrics, setLoadingMetrics] = React.useState(true);

  const [errHealth, setErrHealth] = React.useState<string | null>(null);
  const [errMetrics, setErrMetrics] = React.useState<string | null>(null);

  const [lastRefresh, setLastRefresh] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    // Don’t clear existing h/m — keep last known values on screen
    setErrHealth(null);
    setErrMetrics(null);

    setLoadingHealth(true);
    setLoadingMetrics(true);

    // Run independently so one failure doesn't kill the other
    const pHealth = (async () => {
      try {
        const hh = await health();
        setH(hh);
      } catch (e: any) {
        setErrHealth(e?.message || "Failed to load /health");
      } finally {
        setLoadingHealth(false);
      }
    })();

    const pMetrics = (async () => {
      try {
        const mm = await getDashboardMetrics();
        setM(mm);
      } catch (e: any) {
        setErrMetrics(e?.message || "Failed to load /dashboard/metrics");
      } finally {
        setLoadingMetrics(false);
      }
    })();

    await Promise.allSettled([pHealth, pMetrics]);
    setLastRefresh(new Date().toISOString());
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const loading = loadingHealth || loadingMetrics;

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
        <h1 className="h1">Dashboard</h1>
        <p className="dashboard-subtitle">An overview of your users, channels, and packages.</p>
        </div>
      </div>
      <section className="dashboard-summary" aria-labelledby="dashboard-summary-heading">
        <div className="dashboard-summary-header">
        <h2 id="dashboard-summary-heading">Overview</h2>
        <div className="dashboard-refresh">
          <span className="dashboard-refresh-time" role="status">
            {lastRefresh ? <>
              Last refresh <time dateTime={lastRefresh} title={fmtDateTime(lastRefresh)}>
                {new Date(lastRefresh).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </time>
            </> : "Loading dashboard"}
          </span>
          <button className="dashboard-refresh-button" type="button" onClick={reload} disabled={loading} aria-label="Refresh dashboard" aria-busy={loading}>
            <svg className={loading ? "is-refreshing" : undefined} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 4v6h-6M4 20v-6h6" />
              <path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {(errMetrics || errHealth) && (
        <div style={{ marginBottom: 12 }}>
          {errMetrics && (
            <div className="error" style={{ marginBottom: errHealth ? 8 : 0 }}>
              Metrics error: {errMetrics}
            </div>
          )}
          {errHealth && (
            <div className="error">
              Health error: {errHealth}
            </div>
          )}
        </div>
      )}

      <dl className="dashboard-metrics" aria-busy={loadingMetrics}>
        <SummaryMetric title="Total users" value={m?.users_total} loading={loadingMetrics} />
        <SummaryMetric title="Channels" value={m?.channels_total} loading={loadingMetrics} />
        <SummaryMetric title="Categories" value={m?.categories_total} loading={loadingMetrics} />
        <SummaryMetric title="Packages" value={m?.packages_total} loading={loadingMetrics} />
      </dl>
      <dl className="dashboard-user-status" aria-label="User status" aria-busy={loadingMetrics}>
        <SummaryMetric title="Active" value={m?.users_active} loading={loadingMetrics} />
        <SummaryMetric title="Trial" value={m?.users_trial} loading={loadingMetrics} />
        <SummaryMetric title="Disabled" value={m?.users_disabled} loading={loadingMetrics} />
        <SummaryMetric title="Suspended" value={m?.users_suspended} loading={loadingMetrics} />
      </dl>
      </section>

      {/* Analytics Bar Chart */}
      <PackageBarChart
        packages={m?.users_by_package || []}
        loading={loadingMetrics}
      />

      <section className="dashboard-panel" aria-labelledby="package-breakdown-heading" aria-busy={loadingMetrics}>
        <div className="dashboard-panel-header">
          <div>
            <h2 id="package-breakdown-heading">Package breakdown</h2>
            <p>Channel coverage and active subscribers by package.</p>
          </div>
          {m?.generated_at && <span className="dashboard-generated">Updated <time title={fmtDateTime(m.generated_at)}>{fmtDateTime(m.generated_at)}</time></span>}
        </div>
        {loadingMetrics ? <p className="dashboard-panel-empty" role="status">Loading packages…</p>
          : !m ? <p className="dashboard-panel-empty">Package data is currently unavailable.</p>
          : m.users_by_package.length === 0 ? <p className="dashboard-panel-empty">No package assignments found.</p>
          : <div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Package breakdown table">
            <table className="dashboard-package-table">
              <thead><tr>
                <th scope="col">Package</th>
                <th scope="col" className="numeric">Channels</th>
                <th scope="col" className="numeric">Active users</th>
              </tr></thead>
              <tbody>{m.users_by_package.map(p => <tr key={p.package_id}>
                <th scope="row"><span className="dashboard-package-name">{p.package_name}</span><span className="dashboard-package-id">#{p.package_id}</span></th>
                <td className={`numeric${p.channels_count ? "" : " is-zero"}`}>{(p.channels_count ?? 0).toLocaleString()}</td>
                <td className="numeric"><span className={p.users_count > 0 ? "dashboard-active-count" : "is-zero"}>{p.users_count.toLocaleString()}</span></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>

      <section className="dashboard-panel dashboard-health" aria-labelledby="system-health-heading" aria-busy={loadingHealth}>
        <div className="dashboard-health-title">
          <h2 id="system-health-heading">System health</h2>
          <span className={`dashboard-health-status ${loadingHealth ? "" : h?.ok === true ? "is-healthy" : "is-unavailable"}`} role="status">
            <i aria-hidden="true" />{loadingHealth ? "Checking…" : h?.ok === true ? "Operational" : h ? "Needs attention" : "Unavailable"}
          </span>
        </div>
        <dl className="dashboard-health-details">
          <div><dt>Service</dt><dd>{h?.service || "Unavailable"}</dd></div>
          <div><dt>Last checked</dt><dd>{loadingHealth ? "Checking…" : h?.timestamp ? <time title={fmtDateTime(h.timestamp)}>{fmtDateTime(h.timestamp)}</time> : "Unavailable"}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function SummaryMetric(props: { title: string; value: number | null | undefined; loading: boolean }) {
  const { title, value, loading } = props;

  return (
    <div>
      <dt>{title}</dt>
      <dd>{loading ? "…" : value?.toLocaleString() ?? "—"}</dd>
    </div>
  );
}
