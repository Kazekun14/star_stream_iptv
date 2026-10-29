import React from "react";
import { listPackages, type Package } from "../../api/packages";
import { listChannels } from "../../api/live";
import { listPackageChannels, updatePackageChannels } from "../../api/packageChannels";
import type { LiveChannel } from "../../api/types";
import { useToast } from "../../components/Toast";
import "./package-channels.css";

export default function PackageChannelsPage() {
  const toast = useToast();
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [channels, setChannels] = React.useState<LiveChannel[]>([]);
  const [packageId, setPackageId] = React.useState<number | "">("");
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [saved, setSaved] = React.useState<Set<number>>(new Set());
  const [initializing, setInitializing] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [catalogError, setCatalogError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  async function loadCatalog() {
    setInitializing(true); setCatalogError("");
    try {
      const [pkgs, first] = await Promise.all([listPackages(), listChannels({ limit: 200, offset: 0 })]);
      const all = [...first.items];
      while (all.length < first.paging.total) {
        const next = await listChannels({ limit: 200, offset: all.length });
        if (!next.items.length) throw new Error("The channel library could not be fully loaded.");
        all.push(...next.items);
      }
      setPackages(pkgs); setChannels(all);
    } catch (e: any) { setCatalogError(e?.message || "Unable to load the library."); }
    finally { setInitializing(false); }
  }
  React.useEffect(() => { loadCatalog(); }, []);
  async function loadLineup(pid: number) {
    setLoading(true); setError("");
    try {
      const items = await listPackageChannels(pid);
      const ids = new Set(items.map((i) => i.channel_id));
      setSelected(ids); setSaved(ids);
    } catch (e: any) { setError(e?.message || "Unable to load this lineup."); }
    finally { setLoading(false); }
  }
  const dirty = selected.size !== saved.size || [...selected].some((id) => !saved.has(id));
  const blocked = !packageId || initializing || loading || saving || !!error || !!catalogError;
  const activePackage = packages.find((p) => p.id === packageId);
  const visible = React.useMemo(() => [...channels].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)).filter((c) =>
    `${c.number} ${c.name} ${c.channel_key}`.toLowerCase().includes(q.trim().toLowerCase()) &&
    (filter === "all" || (filter === "selected" ? selected.has(c.id) : !selected.has(c.id)))
  ), [channels, q, filter, selected]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageChannels = visible.slice(start, start + pageSize);
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 1);
  React.useEffect(() => { setPage(1); }, [q, filter, packageId, pageSize]);
  React.useEffect(() => { setPage((previous) => Math.min(previous, pageCount)); }, [pageCount]);
  function changeVisible(include: boolean) {
    setSelected((prev) => { const next = new Set(prev); pageChannels.forEach((c) => include ? next.add(c.id) : next.delete(c.id)); return next; });
  }
  async function save() {
    if (blocked || !packageId) return;
    setSaving(true);
    try {
      const result = await updatePackageChannels(packageId, [...selected].sort((a, b) => a - b));
      if ((result as { ok?: boolean })?.ok === false) throw new Error("Unable to save package channels.");
      setSaved(new Set(selected)); toast.push({ type: "ok", title: "Package channels updated" });
    } catch (e: any) { toast.push({ type: "error", title: "Save failed", message: e?.message || String(e) }); }
    finally { setSaving(false); }
  }
  return <div className="container package-channels">
    <header className="pc-header"><div><h1 className="h1">Package Channels</h1><p>Curate your channel lineup and choose what’s included in each package.</p></div><button className="btn pc-save" onClick={save} disabled={blocked || !dirty}>{saving ? "Saving…" : "Save changes"}</button></header>
    <section className="pc-package" aria-label="Package selection">
      <div><span className="pc-eyebrow">PACKAGE LINEUP</span><h2>Manage your channel lineup</h2><p>Select a package, choose its channels, and save your lineup.</p></div>
      <div className="pc-picker"><label htmlFor="pc-package">Manage package</label><select id="pc-package" className="select" value={packageId} disabled={initializing || saving || loading || !!catalogError} onChange={(e) => {
        if (dirty && !window.confirm("Discard unsaved channel changes and switch packages?")) return;
        const pid = e.target.value ? Number(e.target.value) : "";
        setPackageId(pid); setSelected(new Set()); setSaved(new Set()); setFilter("all"); setQ(""); setError("");
        if (pid) loadLineup(pid);
      }}><option value="">{initializing ? "Loading packages…" : "Choose a package…"}</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}</select><span className="pc-hint">{activePackage ? `${activePackage.status === "active" ? "Active" : "Disabled"} package · #${activePackage.id}` : "Start by choosing a package to manage."}</span></div>
    </section>
    <div className="pc-stats" aria-label="Lineup overview">
      <div><span>Available channels</span><strong>{initializing || catalogError ? "—" : channels.length}</strong><small>Across your channel library</small></div>
      <div><span>In this package</span><strong>{!packageId || loading || error ? "—" : selected.size}</strong><small>Your selected lineup</small></div>
      <div><span>Changes</span><strong className={dirty ? "pc-accent" : ""}>{!packageId ? "—" : loading ? "Loading…" : error ? "Unavailable" : dirty ? "Unsaved" : "Up to date"}</strong><small>{dirty ? "Save to apply your selection" : "Manage selections below"}</small></div>
    </div>
    <section className="pc-library" aria-labelledby="pc-library-title" aria-busy={loading || initializing}>
      <div className="pc-library-heading"><div><h2 id="pc-library-title">Channel library</h2><p>{activePackage ? `Choose channels for ${activePackage.name}.` : "Your next lineup starts here."}</p></div><button className="btn" disabled={blocked} onClick={() => { if (dirty && !window.confirm("Discard unsaved changes and reload this package?")) return; if (packageId) loadLineup(packageId); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v6h-6M4 20v-6h6" /><path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16" /></svg>Refresh lineup</button></div>
      {catalogError ? <div className="pc-empty" role="alert"><h3>Couldn’t load the library</h3><p>{catalogError}</p><button className="btn" onClick={loadCatalog}>Try again</button></div>
      : initializing || loading ? <div className="pc-empty" role="status"><h3>Loading {initializing ? "your library" : "package channels"}…</h3><p>Your lineup will be ready in a moment.</p></div>
      : !packageId ? <div className="pc-empty"><div className="pc-empty-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4M9 8l6 3-6 3V8Z"/></svg></div><h3>{packages.length ? "Choose a package to get started" : "No packages yet"}</h3><p>{packages.length ? "Select a package above to view and customize its channel lineup." : "Create a package on the Packages page, then return to assign channels."}</p></div>
      : error ? <div className="pc-empty" role="alert"><h3>Couldn’t load this lineup</h3><p>{error}</p><button className="btn" onClick={() => loadLineup(packageId)}>Try again</button></div>
      : <>
        <div className="pc-tools"><div className="pc-tabs" role="group" aria-label="Filter channels">{[["all", "All channels"], ["selected", "Selected"], ["unselected", "Not selected"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><input className="input pc-search" aria-label="Search channels" placeholder="Search by name, number, or key…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="pc-bulk"><span>{visible.length} channels shown · {selected.size} selected</span><div><button className="btn small" disabled={blocked || !pageChannels.length} onClick={() => changeVisible(true)}>Select this page</button><button className="btn small" disabled={blocked || !pageChannels.some((c) => selected.has(c.id))} onClick={() => changeVisible(false)}>Clear this page</button></div></div>
        <div className="pc-table-wrap"><table className="pc-table"><thead><tr><th scope="col"><span className="pc-sr-only">Selection</span></th><th scope="col">Channel</th><th scope="col">Channel key</th><th scope="col">Status</th><th scope="col">Package access</th></tr></thead><tbody>{pageChannels.map((c) => <tr key={c.id} className={selected.has(c.id) ? "pc-selected" : ""}><td><input type="checkbox" aria-label={`Include ${c.name} in package`} checked={selected.has(c.id)} disabled={blocked} onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}/></td><td><div className="pc-channel"><span className="pc-number">{c.number}</span><strong>{c.name}</strong></div></td><td><code>{c.channel_key}</code></td><td><span className={`pc-status ${c.enabled ? "is-enabled" : ""}`}><i />{c.enabled ? "Enabled" : "Disabled"}</span></td><td><span className={selected.has(c.id) ? "pc-accent" : "pc-hint"}>{selected.has(c.id) ? "Included" : "Not included"}</span></td></tr>)}</tbody></table></div>
        {!visible.length && <div className="pc-empty"><h3>{channels.length ? "No matching channels" : "No channels available"}</h3><p>{channels.length ? "Try another search or change your selection filter." : "Add channels to your library before building this lineup."}</p>{(q || filter !== "all") && <button className="btn" onClick={() => { setQ(""); setFilter("all"); }}>Reset filters</button>}</div>}
        <div className="pc-pagination">
          <div className="pc-page-size"><label htmlFor="pc-page-size">Rows per page</label><select id="pc-page-size" className="select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
          <span className="pc-page-range" role="status">{visible.length ? start + 1 : 0}&ndash;{Math.min(start + pageSize, visible.length)} of {visible.length} channels</span>
          <nav className="pc-page-controls" aria-label="Channel table pagination">
            <button className="btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"><span aria-hidden="true">&lsaquo;</span> <span>Previous</span></button>
            {pageNumbers.map((number, index) => <React.Fragment key={number}>
              {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="pc-page-gap" aria-hidden="true">&hellip;</span>}
              <button className="btn pc-page-number" aria-label={"Page " + number} aria-current={currentPage === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>
            </React.Fragment>)}
            <button className="btn" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page"><span>Next</span> <span aria-hidden="true">&rsaquo;</span></button>
          </nav>
        </div>
        <footer className="pc-footer"><span role="status">{saving ? "Saving your lineup…" : dirty ? "You have unsaved changes." : "Your lineup is up to date."}</span><span>Selections apply when you save changes.</span></footer>
      </>}
    </section>
  </div>;
}
