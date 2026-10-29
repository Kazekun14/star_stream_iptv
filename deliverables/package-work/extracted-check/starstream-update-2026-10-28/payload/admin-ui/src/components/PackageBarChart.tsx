import React from "react";
import type { PackageMetric } from "../api/dashboard";
import "./packageBarChart.css";

interface PackageBarChartProps {
  packages: PackageMetric[];
  loading?: boolean;
}

const series = [
  { key: "users_count", label: "Users", color: "#fb923c" },
  { key: "channels_count", label: "Channels", color: "#7da7cf" },
] as const;

export default function PackageBarChart({ packages, loading = false }: PackageBarChartProps) {
  const [scale, setScale] = React.useState<"counts" | "relative">("counts");
  const width = Math.max(720, packages.length * 140 + 72);
  const height = 320;
  const left = 48;
  const right = 24;
  const top = 28;
  const baseline = 256;
  const plotHeight = baseline - top;
  const slot = (width - left - right) / Math.max(packages.length, 1);
  const maxima = series.map(s => Math.max(1, ...packages.map(p => p[s.key])));
  const largest = Math.max(...maxima);
  const step = Math.max(1, Math.ceil(largest / 4));
  const ceiling = step * 4;

  return (
    <section className="pbc-container" aria-label="Package analytics" aria-busy={loading}>
      <div className="pbc-header">
        <div>
          <h2>Package analytics</h2>
          <p>Compare subscribers and included channels across packages.</p>
        </div>
        <div className="pbc-scale-switch" role="group" aria-label="Chart scale">
          <button type="button" aria-pressed={scale === "counts"} onClick={() => setScale("counts")}>Counts</button>
          <button type="button" aria-pressed={scale === "relative"} onClick={() => setScale("relative")}>Relative</button>
        </div>
      </div>
      <div className="pbc-toolbar">
        <div className="pbc-legend" aria-label="Chart legend">
          {series.map(s => <span key={s.key}><i style={{ background: s.color }} aria-hidden="true" />{s.label}</span>)}
        </div>
        <span>{packages.length} {packages.length === 1 ? "package" : "packages"}</span>
      </div>
      {loading ? <div className="pbc-empty" role="status">Loading package analytics…</div>
        : packages.length === 0 ? <div className="pbc-empty">No package data available yet.</div>
        : <>
          <div className="pbc-chart-scroll" tabIndex={0} role="region" aria-label="Package comparison chart; scroll horizontally to see more packages">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} className="pbc-chart" role="img" aria-label={`Users and channels by package, ${scale === "counts" ? "actual counts" : "percentage of each metric's maximum"}`}>
              <desc>{packages.map(p => `${p.package_name}: ${p.users_count} users, ${p.channels_count} channels.`).join(" ")}</desc>
              {[0, 1, 2, 3, 4].map(tick => {
                const y = baseline - tick / 4 * plotHeight;
                return <g key={tick}>
                  <line x1={left} x2={width - right} y1={y} y2={y} className="pbc-grid" />
                  <text x={left - 12} y={y + 4} textAnchor="end" className="pbc-axis">{scale === "counts" ? tick * step : `${tick * 25}%`}</text>
                </g>;
              })}
              {packages.map((pkg, index) => {
                const center = left + slot * (index + 0.5);
                return <g key={pkg.package_id}>
                  {series.map((s, seriesIndex) => {
                    const value = pkg[s.key];
                    const barHeight = value / (scale === "counts" ? ceiling : maxima[seriesIndex]) * plotHeight;
                    const x = center + (seriesIndex === 0 ? -29 : 5);
                    return <g key={s.key}>
                      <rect x={x} y={baseline - barHeight} width={24} height={barHeight} rx={3} fill={s.color}>
                        <title>{pkg.package_name} — {s.label}: {value.toLocaleString()}</title>
                      </rect>
                      <text x={x + 12} y={baseline - barHeight - 8} textAnchor="middle" className="pbc-value">{value.toLocaleString()}</text>
                    </g>;
                  })}
                  <text x={center} y={baseline + 28} textAnchor="middle" className="pbc-package">
                    <title>{pkg.package_name}</title>
                    {pkg.package_name.length > 18 ? `${pkg.package_name.slice(0, 17)}…` : pkg.package_name}
                  </text>
                </g>;
              })}
            </svg>
          </div>
          <p className="pbc-note">{scale === "counts" ? "Actual counts per package." : "Each metric is scaled to its own highest package value (100%). Labels show actual counts."}</p>
        </>}
    </section>
  );
}