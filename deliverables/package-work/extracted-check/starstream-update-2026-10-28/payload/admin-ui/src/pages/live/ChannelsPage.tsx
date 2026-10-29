// src/pages/live/ChannelsPage.tsx
import React from "react";
import type { LiveChannel, LiveCategory } from "../../api/types";
import {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  listCategories,
  uploadChannelLogo,
} from "../../api/live";
import { DataTable, type Col } from "../../components/DataTable";
import { Modal } from "../../components/Modal";
import { Confirm } from "../../components/Confirm";
import { useToast } from "../../components/Toast";
import { fmtDateTime } from "../../utils/date";
import { clamp } from "../../utils/strings";
import "./categories.css";

function normBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return !!v;
}

function logoUrl(r: LiveChannel): string | null {
  const u = (r.logo_uri || "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/")) return u;
  return `/${u}`;
}

function ChannelLogoThumb({ src, name }: { src: string | null; name?: string }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const isEmpty = !src || failed;

  return (
    <div className={`channel-logo-box${isEmpty ? " is-empty" : ""}`} title={isEmpty ? "No logo" : name}>
      {!isEmpty ? (
        <img
          src={src}
          alt={name ? `${name} logo` : ""}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="channel-logo-empty" aria-label="No logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </span>
      )}
    </div>
  );
}

export default function ChannelsPage() {
  const toast = useToast();

  const [rows, setRows] = React.useState<LiveChannel[]>([]);
  const [cats, setCats] = React.useState<LiveCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  
  // Server-side pagination
const [limit, setLimit] = React.useState(50);
const [offset, setOffset] = React.useState(0);
const [total, setTotal] = React.useState(0);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LiveChannel | null>(null);

  const [name, setName] = React.useState("");
  const [number, setNumber] = React.useState<string>("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [sourceUri, setSourceUri] = React.useState("");
  const [bitrate, setBitrate] = React.useState<string>("");
  const [enabled, setEnabled] = React.useState(true);
  const [description, setDescription] = React.useState("");

  // Logo upload state
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [logoBusy, setLogoBusy] = React.useState(false);

  const [confirmDel, setConfirmDel] = React.useState<LiveChannel | null>(null);

  async function reload(next?: { limit?: number; offset?: number }) {
  const nextLimit = next?.limit ?? limit;
  const nextOffset = next?.offset ?? offset;

  setLoading(true);
  setErr(null);

  try {
    const [channelResult, cg] = await Promise.all([
      listChannels({
        limit: nextLimit,
        offset: nextOffset,
      }),
      listCategories(),
    ]);

    setRows(channelResult.items);
    setCats(cg);
    setLimit(channelResult.paging.limit);
    setOffset(channelResult.paging.offset);
    setTotal(channelResult.paging.total);
  } catch (e: any) {
    setErr(e?.message || "Failed to load channels");
  } finally {
    setLoading(false);
  }
}

  React.useEffect(() => {
    reload();
  }, []);

  function catName(id?: number | null) {
    if (!id) return "";
    return cats.find((c) => c.id === id)?.category || String(id);
  }

  function resetForm() {
    setName("");
    setNumber("");
    setCategoryId("");
    setSourceUri("");
    setBitrate("");
    setEnabled(true);
    setDescription("");

    setLogoFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setEditOpen(true);
  }

  function openEdit(c: LiveChannel) {
    setEditing(c);

    setName(c.name || "");
    setNumber(c.number == null ? "" : String(c.number));
    setCategoryId(c.category_id == null ? "" : String(c.category_id));
    setSourceUri(c.source_uri || "");
    setBitrate(c.bitrate_kbps == null ? "" : String(c.bitrate_kbps));
    setEnabled(normBool(c.enabled ?? true));
    setDescription(c.description || "");

    setLogoFile(null);
    if (fileRef.current) fileRef.current.value = "";

    setEditOpen(true);
  }

  function onPickLogoFile(f?: File | null) {
    if (!f) {
      setLogoFile(null);
      return;
    }

    // Client-side sanity checks (server still enforces)
    const MAX_BYTES = 2 * 1024 * 1024; // must match backend
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    if (f.size > MAX_BYTES) {
      toast.push({ type: "error", title: "File too large", message: "Max 2MB." });
      if (fileRef.current) fileRef.current.value = "";
      setLogoFile(null);
      return;
    }
    if (f.type && !allowed.includes(f.type)) {
      toast.push({ type: "error", title: "Unsupported format", message: "Use PNG/JPG/WebP/GIF." });
      if (fileRef.current) fileRef.current.value = "";
      setLogoFile(null);
      return;
    }

    setLogoFile(f);
  }

  async function save() {
    const payload: Partial<LiveChannel> = {
      name: name.trim(),
      number: number.trim() === "" ? null : Number(number),
      category_id: categoryId.trim() === "" ? null : Number(categoryId),
      source_uri: sourceUri.trim() === "" ? null : sourceUri.trim(),
      bitrate_kbps: bitrate.trim() === "" ? null : Number(bitrate),
      enabled: enabled ? 1 : 0,
      description: description.trim() === "" ? null : description.trim(),
    };

    if (!payload.name) throw new Error("Name is required");

    try {
      let channelId: number;

      if (editing) {
        await updateChannel(editing.id, payload);
        channelId = editing.id;
        toast.push({ type: "ok", title: "Channel updated" });
      } else {
        const created: any = await createChannel(payload);
        channelId = Number(created?.id);
        if (!channelId || Number.isNaN(channelId)) throw new Error("Create failed: missing channel id");
        toast.push({ type: "ok", title: "Channel created" });
      }

      // Optional logo upload, then refresh list so logo shows in column.
      if (logoFile) {
        setLogoBusy(true);
        try {
          await uploadChannelLogo(channelId, logoFile);
          toast.push({ type: "ok", title: "Logo uploaded" });
        } finally {
          setLogoBusy(false);
        }
      }

      setEditOpen(false);
      resetForm();

      // IMPORTANT: refresh so the logo_uri/logo_file_id reflect immediately
      await reload();
    } catch (e: any) {
      toast.push({ type: "error", title: "Save failed", message: e?.message || String(e) });
      throw e;
    }
  }

  const filtered = rows.filter((r) => {
    const hay = `${r.name || ""} ${r.number ?? ""} ${catName(r.category_id)}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const currentPage = Math.floor(offset / limit) + 1;
const totalPages = Math.max(1, Math.ceil(total / limit));
const firstItem = total === 0 ? 0 : offset + 1;
const lastItem = Math.min(offset + rows.length, total);
const canGoPrevious = offset > 0;
const canGoNext = offset + limit < total;

  const cols: Col<LiveChannel>[] = [
    { key: "id", header: "ID", width: 72, render: (r) => <span className="category-id">#{r.id}</span> },

    {
      key: "logo",
      header: "Logo",
      width: 84,
      render: (r) => {
        const u = logoUrl(r);
        const bust = r.logo_file_id ? `?v=${r.logo_file_id}` : "";
        const src = u ? `${u}${bust}` : null;

        return <ChannelLogoThumb src={src} name={r.name} />;
      },
    },

    {
      key: "num",
      header: "#",
      width: 72,
      render: (r) => <span className="channel-number">{r.number ?? "—"}</span>,
    },
    {
      key: "name",
      header: "Channel",
      render: (r) => <span className="category-name">{r.name}</span>,
    },
    {
      key: "cat",
      header: "Category",
      width: 150,
      render: (r) => {
        const c = catName(r.category_id);
        return c ? <span className="channel-category-badge">{c}</span> : <span className="channel-unassigned">—</span>;
      },
    },
    {
      key: "src",
      header: "Source",
      width: 240,
      render: (r) =>
        r.source_uri ? (
          <code className="channel-source" title={r.source_uri}>
            {clamp(r.source_uri, 34)}
          </code>
        ) : (
          <span className="channel-unassigned">—</span>
        ),
    },
    {
      key: "en",
      header: "Status",
      width: 120,
      render: (r) => (
        <span className={`category-status${normBool(r.enabled) ? " is-enabled" : ""}`}>
          <i aria-hidden="true" />
          {normBool(r.enabled) ? "Enabled" : "Disabled"}
        </span>
      ),
    },
    {
      key: "upd",
      header: "Last updated",
      width: 195,
      render: (r) => <span className="category-updated">{fmtDateTime(r.updated_at) || "—"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      width: 175,
      render: (r) => (
        <div className="category-actions">
          <button className="category-action" type="button" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5L8 21H3v-5L16 3ZM14 5l5 5" /></svg>Edit
          </button>
          <button className="category-action category-action-delete" type="button" aria-label={`Delete ${r.name}`} onClick={() => setConfirmDel(r)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>Delete
          </button>
        </div>
      ),
    },
  ];

  const currentLogo = editing ? logoUrl(editing) : null;
  const currentLogoBust = editing?.logo_file_id ? `?v=${editing.logo_file_id}` : "";
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);
  const [modalLogoFailed, setModalLogoFailed] = React.useState(false);

  React.useEffect(() => {
    setModalLogoFailed(false);
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile, currentLogo, editOpen]);

  const activeModalLogo = logoPreviewUrl || (!modalLogoFailed && currentLogo ? `${currentLogo}${currentLogoBust}` : null);

  return (
    <div className="container">
      <header className="categories-header">
        <h1 className="h1">Channels</h1>
        <p>Manage your television channels, stream sources, categories, and availability.</p>
      </header>

      <div className="categories-toolbar">
        <span className="categories-count" role="status">
          <span className="categories-count-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <path d="m8 2 4 4 4-4m-6 9 5 3-5 3Z" />
            </svg>
          </span>
          <span className="categories-count-copy">
            <span className="categories-count-label">{q.trim() ? "Matching channels" : "Total channels"}</span>
            <span className="categories-count-value">
              {loading ? (
                <span>Loading…</span>
              ) : (
                <>
                  <strong>{q.trim() ? filtered.length : total}</strong>
                  <span>{q.trim() ? `of ${total} total` : total === 1 ? "channel" : "channels"}</span>
                </>
              )}
            </span>
          </span>
        </span>

        <div className="categories-controls">
          <label className="categories-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              aria-label="Search this page"
              placeholder="Search this page…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button className="categories-button" type="button" onClick={() => reload()} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 4v6h-6M4 20v-6h6" />
              <path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="categories-button categories-create" type="button" onClick={openCreate} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New channel
          </button>
        </div>
      </div>

      {err ? <div className="error" style={{ marginBottom: 12 }}>{err}</div> : null}

      <div className="categories-table channels-table" role="region" aria-label="Channels list" aria-busy={loading} tabIndex={0}>
        <DataTable
          cols={cols}
          rows={filtered}
          emptyText={loading ? "Loading…" : "No channels"}
        />

        <div className="channels-pagination">
          <span className="channels-pagination-summary">
            {q.trim() ? (
              <><strong>{filtered.length}</strong> matching channels on this page</>
            ) : (
              <>Showing <strong>{firstItem}–{lastItem}</strong> of <strong>{total}</strong> channels</>
            )}
          </span>

          <div className="channels-pagination-controls">
            <label className="channels-rows-per-page">
              <span>Rows per page</span>
              <select
                className="channels-page-select"
                value={limit}
                disabled={loading}
                onChange={(e) => {
                  const nextLimit = Number(e.target.value);
                  void reload({ limit: nextLimit, offset: 0 });
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>

            <div className="channels-page-nav">
              <button
                className="category-action"
                type="button"
                disabled={loading || !canGoPrevious}
                onClick={() =>
                  void reload({
                    offset: Math.max(0, offset - limit),
                  })
                }
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                Previous
              </button>

              <span className="channels-page-indicator">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>

              <button
                className="category-action"
                type="button"
                disabled={loading || !canGoNext}
                onClick={() =>
                  void reload({
                    offset: offset + limit,
                  })
                }
              >
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>   
  
      <Modal
        className="category-modal channel-modal"
        subtitle="Configure channel details, stream source, logo, and availability."
        open={editOpen}
        title={editing ? `Edit channel #${editing.id}` : "New channel"}
        onClose={() => { if (!logoBusy) setEditOpen(false); }}
        footer={
          <>
            <div className="spacer" />
            <button className="categories-button" type="button" onClick={() => setEditOpen(false)} disabled={logoBusy}>
              Cancel
            </button>
            <button
              className="categories-button categories-create"
              type="button"
              disabled={!name.trim() || logoBusy}
              onClick={() => { void save().catch(() => {}); }}
            >
              {logoBusy ? "Uploading…" : editing ? "Save changes" : "Create channel"}
            </button>
          </>
        }
      >
        <form
          className="category-form channel-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || logoBusy) return;
            void save().catch(() => {});
          }}
        >
          {/* Logo upload card */}
          <div className="channel-logo-card">
            <div className={`channel-logo-preview${!activeModalLogo ? " is-empty" : ""}`}>
              {activeModalLogo ? (
                <img
                  src={activeModalLogo}
                  alt="Channel logo preview"
                  onError={() => setModalLogoFailed(true)}
                />
              ) : (
                <span className="channel-logo-empty" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => onPickLogoFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="channel-logo-info">
              <div className="channel-logo-heading">
                <span>Channel logo</span>
                <span className="category-badge">Optional</span>
              </div>
              <p>PNG, JPG, WebP, or GIF • Max 2 MB (converted to square PNG).</p>
              {logoFile ? (
                <div className="channel-file-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  <span>{logoFile.name}</span>
                  <small>({Math.max(1, Math.round(logoFile.size / 1024))} KB)</small>
                </div>
              ) : null}
            </div>

            <div className="channel-logo-actions">
              <button
                className="category-action"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={logoBusy}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                Choose…
              </button>
              {logoFile ? (
                <button
                  className="category-action category-action-delete"
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  disabled={logoBusy}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Primary fields: Name, Number, Category */}
          <div className="channel-form-grid-3">
            <div className="category-field">
              <div className="category-field-label">
                <label htmlFor="channel-name">Channel name</label>
                <span className="category-badge is-required">Required</span>
              </div>
              <input
                id="channel-name"
                className="input category-input"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HBO HD"
              />
            </div>

            <div className="category-field">
              <div className="category-field-label">
                <label htmlFor="channel-number">Number</label>
                <span className="category-badge">Optional</span>
              </div>
              <input
                id="channel-number"
                className="input category-input"
                type="number"
                step="1"
                min="0"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>

            <div className="category-field">
              <div className="category-field-label">
                <label htmlFor="channel-category">Category</label>
                <span className="category-badge">Optional</span>
              </div>
              <select
                id="channel-category"
                className="select category-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Uncategorized</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stream fields: Source URI, Bitrate */}
          <div className="channel-form-grid-2">
            <div className="category-field">
              <div className="category-field-label">
                <label htmlFor="channel-source">Source URI</label>
                <span className="category-badge">Optional</span>
              </div>
              <input
                id="channel-source"
                className="input category-input channel-mono-input"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
                placeholder="udp://@239.0.0.1:1234"
              />
            </div>

            <div className="category-field">
              <div className="category-field-label">
                <label htmlFor="channel-bitrate">Bitrate (kbps)</label>
                <span className="category-badge">Optional</span>
              </div>
              <input
                id="channel-bitrate"
                className="input category-input"
                type="number"
                step="1"
                min="0"
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                placeholder="e.g. 2500"
              />
            </div>
          </div>

          {/* Description */}
          <div className="category-field">
            <div className="category-field-label">
              <label htmlFor="channel-description">Description</label>
              <span className="category-badge">Optional</span>
            </div>
            <textarea
              id="channel-description"
              className="textarea category-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the channel…"
            />
          </div>

          {/* Availability toggle card */}
          <label
            htmlFor="channel-enabled"
            className={`category-availability${enabled ? " is-enabled" : ""}`}
          >
            <div className="category-availability-copy">
              <div className="category-availability-title">
                <span>Enable channel</span>
                <span className={`category-availability-pill${enabled ? " is-on" : ""}`}>
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p>Make this channel visible and available for playback.</p>
            </div>
            <input
              id="channel-enabled"
              className="category-switch"
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>
        </form>
      </Modal>

      <Confirm
        open={!!confirmDel}
        title={confirmDel ? `Delete channel #${confirmDel.id}?` : "Delete channel?"}
        message={confirmDel ? `"${confirmDel.name}" will be permanently removed. This action cannot be undone.` : "This action cannot be undone."}
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await deleteChannel(confirmDel.id);
          toast.push({ type: "ok", title: "Channel deleted" });
          setConfirmDel(null);
          await reload();
        }}
      />
    </div>
  );
}
