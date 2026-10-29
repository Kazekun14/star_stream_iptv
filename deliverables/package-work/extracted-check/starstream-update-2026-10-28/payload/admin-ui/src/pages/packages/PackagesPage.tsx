import React from "react";
import type { Package } from "../../api/packages";
import { listPackages, createPackage, updatePackage, deletePackage } from "../../api/packages";
import { DataTable, type Col } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Confirm } from "../../components/Confirm";
import { useToast } from "../../components/Toast";
import { fmtDateTime } from "../../utils/date";
import "./packages.css";

export default function PackagesPage() {
  const toast = useToast();

  const [rows, setRows] = React.useState<Package[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Package | null>(null);
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "disabled">("active");

  const [confirmDel, setConfirmDel] = React.useState<Package | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      setRows(await listPackages());
    } catch (e: any) {
      setErr(e?.message || "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { reload(); }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setStatus("active");
    setEditOpen(true);
  }

  function openEdit(p: Package) {
    setEditing(p);
    setName(p.name || "");
    setStatus(p.status || "active");
    setEditOpen(true);
  }

  async function save() {
    const payload: Partial<Package> = {
      name: name.trim(),
      status,
    };
    if (!payload.name) throw new Error("Name is required");

    try {
      if (editing) {
        await updatePackage(editing.id, payload);
        toast.push({ type: "ok", title: "Package updated" });
      } else {
        await createPackage(payload);
        toast.push({ type: "ok", title: "Package created" });
      }
      setEditOpen(false);
      await reload();
    } catch (e: any) {
      toast.push({ type: "error", title: "Save failed", message: e?.message || String(e) });
      throw e;
    }
  }

  const filtered = rows.filter(r => {
    const hay = `${r.name} ${r.status}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const cols: Col<Package>[] = [
    { key: "id", header: "ID", width: 80, render: r => <span className="package-id">#{r.id}</span> },
    { key: "name", header: "Package", render: r => <span className="package-name">{r.name}</span> },
    {
      key: "status",
      header: "Status",
      width: 130,
      render: r => (
        <span className={`package-status${r.status === "active" ? " is-active" : ""}`}>
          <i aria-hidden="true" />
          {r.status}
        </span>
      ),
    },
    { key: "updated", header: "Last updated", width: 210, render: r => <span className="package-updated">{fmtDateTime(r.updated_at) || "—"}</span> },
    {
      key: "actions",
      header: "Actions",
      width: 180,
      render: (r) => (
        <div className="package-actions">
          <button className="package-action" type="button" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5L8 21H3v-5L16 3ZM14 5l5 5" /></svg>Edit
          </button>
          <button className="package-action package-action-delete" type="button" aria-label={`Delete ${r.name}`} onClick={() => setConfirmDel(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="container">
      <header className="packages-header">
        <h1 className="h1">Packages</h1>
        <p>Create and manage subscription packages and control their availability.</p>
      </header>

      <div className="packages-toolbar">
        <span className="packages-count" role="status">
          <span className="packages-count-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" />
              <path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" />
            </svg>
          </span>
          <span className="packages-count-copy">
            <span className="packages-count-label">{q.trim() ? "Matching packages" : "Total packages"}</span>
            <span className="packages-count-value">
              {loading ? (
                <span>Loading…</span>
              ) : (
                <>
                  <strong>{filtered.length}</strong>
                  <span>{q.trim() ? `of ${rows.length} total` : filtered.length === 1 ? "package" : "packages"}</span>
                </>
              )}
            </span>
          </span>
        </span>

        <div className="packages-controls">
          <label className="packages-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              aria-label="Search packages"
              placeholder="Search packages…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
          <button className="packages-button" type="button" onClick={reload} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 4v6h-6M4 20v-6h6" />
              <path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="packages-button packages-create" type="button" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New package
          </button>
        </div>
      </div>

      {err ? <div className="error" style={{ marginBottom: 12 }}>{err}</div> : null}

      <div className="packages-table" role="region" aria-label="Packages list" aria-busy={loading} tabIndex={0}>
        <DataTable cols={cols} rows={filtered} emptyText={loading ? "Loading…" : "No packages"} />
      </div>

      <Modal
        className="category-modal"
        subtitle="Set a package name and control whether it is active for subscribers."
        open={editOpen}
        title={editing ? `Edit package #${editing.id}` : "New package"}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <div className="spacer" />
            <button className="packages-button" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="packages-button packages-create" type="button" disabled={!name.trim()} onClick={() => { void save().catch(() => {}); }}>
              {editing ? "Save changes" : "Create package"}
            </button>
          </>
        }
      >
        <form
          className="category-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void save().catch(() => {});
          }}
        >
          <div className="category-field">
            <div className="category-field-label">
              <label htmlFor="package-name">Package name</label>
              <span className="category-badge is-required">Required</span>
            </div>
            <input
              id="package-name"
              className="input category-input"
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Premium"
            />
          </div>

          <label
            htmlFor="package-status"
            className={`category-availability${status === "active" ? " is-enabled" : ""}`}
          >
            <div className="category-availability-copy">
              <div className="category-availability-title">
                <span>Active status</span>
                <span className={`category-availability-pill${status === "active" ? " is-on" : ""}`}>
                  {status === "active" ? "Active" : "Disabled"}
                </span>
              </div>
              <p>Make this package active and assignable to users.</p>
            </div>
            <input
              id="package-status"
              className="category-switch"
              type="checkbox"
              role="switch"
              checked={status === "active"}
              onChange={e => setStatus(e.target.checked ? "active" : "disabled")}
            />
          </label>
        </form>
      </Modal>

      <Confirm
        open={!!confirmDel}
        title={confirmDel ? `Delete package #${confirmDel.id}?` : "Delete package?"}
        message={confirmDel ? `"${confirmDel.name}" will be permanently removed. This action cannot be undone.` : "This action cannot be undone."}
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await deletePackage(confirmDel.id);
          toast.push({ type: "ok", title: "Package deleted" });
          setConfirmDel(null);
          await reload();
        }}
      />
    </div>
  );
}
