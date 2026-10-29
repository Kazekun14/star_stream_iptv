import React from "react";
import type { LiveCategory } from "../../api/types";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../../api/live";
import { DataTable, type Col } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Confirm } from "../../components/Confirm";
import { useToast } from "../../components/Toast";
import { fmtDateTime } from "../../utils/date";
import "./categories.css";

function normBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return !!v;
}

export default function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = React.useState<LiveCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LiveCategory | null>(null);
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<string>("");
  const [enabled, setEnabled] = React.useState(true);

  const [confirmDel, setConfirmDel] = React.useState<LiveCategory | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const data = await listCategories();
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { reload(); }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setSortOrder("");
    setEnabled(true);
    setEditOpen(true);
  }

  function openEdit(c: LiveCategory) {
    setEditing(c);
    setName(c.category || "");
    setSortOrder(c.sort_order == null ? "" : String(c.sort_order));
    setEnabled(normBool(c.enabled ?? true));
    setEditOpen(true);
  }

  async function save() {
    const payload: Partial<LiveCategory> = {
      category: name.trim(),
      sort_order: sortOrder.trim() === "" ? null : Number(sortOrder),
      enabled: enabled ? 1 : 0,
    };
    if (!payload.category) throw new Error("Name is required");

    try {
      if (editing) {
        await updateCategory(editing.id, payload);
        toast.push({ type: "ok", title: "Category updated" });
      } else {
        await createCategory(payload);
        toast.push({ type: "ok", title: "Category created" });
      }
      setEditOpen(false);
      await reload();
    } catch (e: any) {
      toast.push({ type: "error", title: "Save failed", message: e?.message || String(e) });
      throw e;
    }
  }

  const filtered = rows.filter(r => (r.category || "").toLowerCase().includes(q.trim().toLowerCase()));

  const cols: Col<LiveCategory>[] = [
    { key: "id", header: "ID", width: 80, render: (r) => <span className="category-id">#{r.id}</span> },
    { key: "name", header: "Category", render: (r) => <span className="category-name">{r.category}</span> },
    { key: "sort", header: "Sort order", width: 100, render: (r) => <span className="category-sort">{r.sort_order ?? "—"}</span> },
    { key: "enabled", header: "Status", width: 130, render: (r) => <span className={`category-status${normBool(r.enabled) ? " is-enabled" : ""}`}><i aria-hidden="true" />{normBool(r.enabled) ? "Enabled" : "Disabled"}</span> },
    { key: "updated", header: "Last updated", width: 210, render: (r) => <span className="category-updated">{fmtDateTime(r.updated_at) || "—"}</span> },
    {
      key: "actions",
      header: "Actions",
      width: 180,
      render: (r) => (
        <div className="category-actions">
          <button className="category-action" type="button" aria-label={`Edit ${r.category}`} onClick={() => openEdit(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5L8 21H3v-5L16 3ZM14 5l5 5" /></svg>Edit
          </button>
          <button className="category-action category-action-delete" type="button" aria-label={`Delete ${r.category}`} onClick={() => setConfirmDel(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <header className="categories-header">
        <h1 className="h1">Categories</h1>
        <p>Organize your channels into categories and manage their availability.</p>
      </header>
      <div className="categories-toolbar">
        <span className="categories-count" role="status">
          <span className="categories-count-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <span className="categories-count-copy">
            <span className="categories-count-label">{q.trim() ? "Matching categories" : "Total categories"}</span>
            <span className="categories-count-value">{loading ? <span>Loading…</span> : <><strong>{filtered.length}</strong><span>{q.trim() ? `of ${rows.length} total` : filtered.length === 1 ? "category" : "categories"}</span></>}</span>
          </span>
        </span>
        <div className="categories-controls">
          <label className="categories-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
            <input type="search" aria-label="Search categories" placeholder="Search categories…" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <button className="categories-button" type="button" onClick={reload} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v6h-6M4 20v-6h6" /><path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16" /></svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="categories-button categories-create" type="button" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            New category
          </button>
        </div>
      </div>

      {err ? <div className="error" style={{ marginBottom: 12 }}>{err}</div> : null}

      <div className="categories-table" role="region" aria-label="Categories list" aria-busy={loading} tabIndex={0}>
        <DataTable cols={cols} rows={filtered} emptyText={loading ? "Loading…" : "No categories"} />
      </div>

      <Modal
        className="category-modal"
        subtitle="Set a name, display order, and availability for this category."
        open={editOpen}
        title={editing ? `Edit category #${editing.id}` : "New category"}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <div className="spacer" />
            <button className="categories-button" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="categories-button categories-create" type="button" disabled={!name.trim()} onClick={() => { void save().catch(() => {}); }}>
              {editing ? "Save changes" : "Create category"}
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
              <label htmlFor="category-name">Category name</label>
              <span className="category-badge is-required">Required</span>
            </div>
            <input
              id="category-name"
              className="input category-input"
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sports"
            />
          </div>

          <div className="category-field">
            <div className="category-field-label">
              <label htmlFor="category-sort">Sort order</label>
              <span className="category-badge">Optional</span>
            </div>
            <input
              id="category-sort"
              className="input category-input"
              type="number"
              step="1"
              min="0"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="e.g. 1"
              aria-describedby="category-sort-help"
            />
            <p id="category-sort-help" className="category-field-help">
              Leave blank to use the default order. Lower numbers appear first.
            </p>
          </div>

          <label
            htmlFor="category-enabled"
            className={`category-availability${enabled ? " is-enabled" : ""}`}
          >
            <div className="category-availability-copy">
              <div className="category-availability-title">
                <span>Enable category</span>
                <span className={`category-availability-pill${enabled ? " is-on" : ""}`}>
                  {enabled ? "Active" : "Hidden"}
                </span>
              </div>
              <p>Make this category available for use across channels.</p>
            </div>
            <input
              id="category-enabled"
              className="category-switch"
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
          </label>
        </form>
      </Modal>

      <Confirm
        open={!!confirmDel}
        title={confirmDel ? `Delete category #${confirmDel.id}?` : "Delete category?"}
        message={confirmDel ? `"${confirmDel.category}" will be permanently removed. This action cannot be undone.` : "This action cannot be undone."}
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await deleteCategory(confirmDel.id);
          toast.push({ type: "ok", title: "Category deleted" });
          setConfirmDel(null);
          await reload();
        }}
      />
    </div>
  );
}
