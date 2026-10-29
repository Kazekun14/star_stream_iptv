import { createPortal } from "react-dom";
// src/pages/reg-users/RegUsersPage.tsx
import React from "react";
import "./reg-users.css";
import {
  listRegUsers,
  createRegUser,
  updateRegUser,
  deleteRegUser,
  type RegUser,
} from "../../api/regUsers";
import { createUserPackage } from "../../api/userPackages";
import { http } from "../../api/http";
import { useToast } from "../../components/Toast";
import { Modal } from "../../components/Modal";
import { Confirm } from "../../components/Confirm";

type Status = "active" | "disabled" | "suspended";

type CreateForm = {
  username: string;
  password: string;

  full_name: string;
  email: string;

  address: string;
  area: string;
  telephone: string;
  zipcode: string;
  notes: string;

  status: Status;
  account_expiry: string;

  is_trial: 0 | 1;
  max_connections: number;
  max_live_devices: number;
};

type EditForm = {
  full_name: string;
  email: string;

  address: string;
  area: string;
  telephone: string;
  zipcode: string;
  notes: string;

  status: Status;
  account_expiry: string;

  is_trial: 0 | 1;
  max_connections: number;
  max_live_devices: number;

  bump_auth_epoch: 0 | 1;
  bump_entitlements: 0 | 1;
};

type PasswordForm = {
  password: string;
  bump_auth_epoch: 0 | 1;
};

// ---- Packages (suggest + multi-select) ----
type Package = { id: number; name: string };
type ListPackagesRes = { ok: boolean; items?: Package[]; error?: string };

type UserPackageItem = {
  user_id: number;
  package_id: number;
  starts_at: string | null;
  ends_at: string | null;
  status: "active" | "paused" | "expired";
  package_name?: string | null;
};

type ListUserPackagesRes = { ok: boolean; items?: UserPackageItem[]; error?: string };
type BasicOkRes = { ok: boolean; error?: string };

async function listUserPackages(userId: number): Promise<UserPackageItem[]> {
  const res = await http.get<ListUserPackagesRes>(`/live/reg-users/${userId}/packages`);
  if (!res.ok) throw new Error(res.error || "Failed to load user packages");
  return res.items || [];
}

// CHANGE this if your endpoint differs.
const PACKAGES_LIST_URL = "/live/packages";

// CHANGE this if your endpoint differs.
// Used to remove a package assignment for a user (when deselected).
function userPackageDeleteUrl(userId: number, packageId: number) {
  return `/live/reg-users/${userId}/packages/${packageId}`;
}

// robust delete helper (supports http.del or http.delete)
async function httpDelete<T = any>(url: string): Promise<T> {
  const h: any = http as any;
  if (typeof h.del === "function") return h.del(url);
  if (typeof h.delete === "function") return h.delete(url);
  if (typeof h.remove === "function") return h.remove(url);
  throw new Error("http delete method not found (expected http.del/http.delete)");
}

async function deleteUserPackage(userId: number, packageId: number): Promise<void> {
  const res = await httpDelete<BasicOkRes>(userPackageDeleteUrl(userId, packageId));
  if (!res?.ok) throw new Error(res?.error || "Failed to delete user package");
}

type PackageAssignForm = {
  status: "active" | "paused" | "expired";
  starts_at: string; // optional
  ends_at: string; // optional
};

function to01(v: any): 0 | 1 {
  return v === 1 || v === true || v === "1" ? 1 : 0;
}

function safeNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isValidDateTimeLoose(v: string) {
  const s = v.trim();
  if (!s) return true;
  return /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/.test(s);
}

async function listAllPackages(): Promise<Package[]> {
  try {
    const res = await http.get<ListPackagesRes>(PACKAGES_LIST_URL);
    if (!res.ok) return [];
    return res.items || [];
  } catch {
    return [];
  }
}

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

function Ico({ children }: { children: React.ReactNode }) {
  return (
    <span className="ru-ico" aria-hidden="true">
      {children}
    </span>
  );
}

function IconInfo() {
  return (
    <Ico>
      <svg viewBox="0 0 24 24">
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Zm0-4a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 7Z" />
      </svg>
    </Ico>
  );
}

function IconEdit() {
  return (
    <Ico>
      <svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.13 1.13 3.75 3.75L21 5.75Z" />
      </svg>
    </Ico>
  );
}

function IconKey() {
  return (
    <Ico>
      <svg viewBox="0 0 24 24">
        <path d="M14 3a7 7 0 0 0-6.93 8H3v4h4v-2h2v-2h2.07A7 7 0 1 0 14 3Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
      </svg>
    </Ico>
  );
}

function IconBox() {
  return (
    <Ico>
      <svg viewBox="0 0 24 24">
        <path d="M21 8.5 12 3 3 8.5l9 5.5 9-5.5ZM3 10.5V20l9 5 9-5v-9.5l-9 5.5-9-5.5Z" />
      </svg>
    </Ico>
  );
}

function IconTrash() {
  return (
    <Ico>
      <svg className="ru-trash-icon" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
      </svg>
    </Ico>
  );
}

export default function RegUsersPage() {
  const toast = useToast();

  const [rows, setRows] = React.useState<RegUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [pkgMap, setPkgMap] = React.useState<Record<number, string>>({});
  const [pkgMapLoading, setPkgMapLoading] = React.useState(false);

  // client-side filter (current page only)
  const [q, setQ] = React.useState("");

  // paging (best-effort)
  const [limit, setLimit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  // create/edit
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RegUser | null>(null);
  const [form, setForm] = React.useState<CreateForm | EditForm>({
    username: "",
    password: "",
    full_name: "",
    email: "",
    address: "",
    area: "",
    telephone: "",
    zipcode: "",
    notes: "",
    status: "active",
    account_expiry: "",
    is_trial: 0,
    max_connections: 1,
    max_live_devices: 1,
  } as CreateForm);

  // password modal
  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwUser, setPwUser] = React.useState<RegUser | null>(null);
  const [pwSaving, setPwSaving] = React.useState(false);
  const [pwForm, setPwForm] = React.useState<PasswordForm>({
    password: "",
    bump_auth_epoch: 1,
  });

  // info modal
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoUser, setInfoUser] = React.useState<RegUser | null>(null);

  // packages modal
  const [pkgOpen, setPkgOpen] = React.useState(false);
  const [pkgUser, setPkgUser] = React.useState<RegUser | null>(null);
  const [pkgLoading, setPkgLoading] = React.useState(false);
  const [pkgSaving, setPkgSaving] = React.useState(false);
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [pkgQuery, setPkgQuery] = React.useState("");
  const [pkgSelected, setPkgSelected] = React.useState<Package[]>([]);
  const [pkgAssign, setPkgAssign] = React.useState<PackageAssignForm>({
    status: "active",
    starts_at: "",
    ends_at: "",
  });

  // delete confirm
  const [confirmDel, setConfirmDel] = React.useState<RegUser | null>(null);

  // actions menu (per-row burger)
  const [menuOpenFor, setMenuOpenFor] = React.useState<number | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuTrigger = React.useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 });
  React.useLayoutEffect(() => {
    if (menuOpenFor === null || !menuTrigger.current || !menuRef.current) return;
    const trigger = menuTrigger.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    setMenuPosition({
      left: Math.max(8, Math.min(trigger.right - menu.width, window.innerWidth - menu.width - 8)),
      top: Math.max(8, trigger.bottom + menu.height + 8 <= window.innerHeight ? trigger.bottom + 6 : trigger.top - menu.height - 6),
    });
    menuRef.current.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      setMenuOpenFor(null);
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [menuOpenFor]);
  function toggleMenu(userId: number, trigger: HTMLButtonElement) {
    menuTrigger.current = trigger;
    setMenuOpenFor((cur) => (cur === userId ? null : userId));
  }
  function closeMenu() {
    setMenuOpenFor(null);
  }

  const reload = React.useCallback(
    async (next?: { limit?: number; offset?: number }) => {
      const l = next?.limit ?? limit;
      const o = next?.offset ?? offset;

      setLoading(true);
      try {
        const items = await listRegUsers({ limit: l, offset: o });
        setRows(items);
        hydratePackagesForRows(items);

        // best-effort total (since wrapper returns only items[])
        const knownTotal = Math.max(o + items.length, items.length);
        setTotal(knownTotal);

        setLimit(l);
        setOffset(o);
      } catch (e: any) {
        toast.push({
          type: "error",
          title: "Load failed",
          message: e?.message || "Unable to load users",
        });
      } finally {
        setLoading(false);
      }
    },
    [limit, offset, toast]
  );

  React.useEffect(() => {
    reload();
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setForm({
      username: "",
      password: "",
      full_name: "",
      email: "",
      address: "",
      area: "",
      telephone: "",
      zipcode: "",
      notes: "",
      status: "active",
      account_expiry: "",
      is_trial: 0,
      max_connections: 1,
      max_live_devices: 1,
    } satisfies CreateForm);
    setEditOpen(true);
  }

  function openEdit(u: RegUser) {
    setEditing(u);
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      address: u.address || "",
      area: u.area || "",
      telephone: u.telephone || "",
      zipcode: u.zipcode != null ? String(u.zipcode) : "",
      notes: u.notes || "",
      status: u.status,
      account_expiry: u.account_expiry || "",
      is_trial: to01(u.is_trial),
      max_connections: safeNum(u.max_connections, 1),
      max_live_devices: safeNum(u.max_live_devices, 1),
      bump_auth_epoch: 0,
      bump_entitlements: 0,
    } satisfies EditForm);
    setEditOpen(true);
  }

  function openPassword(u: RegUser) {
    setPwUser(u);
    setPwForm({ password: "", bump_auth_epoch: 1 });
    setPwOpen(true);
  }

  function openInfo(u: RegUser) {
    setInfoUser(u);
    setInfoOpen(true);
  }

  async function openPackages(u: RegUser) {
    setPkgUser(u);
    setPkgSelected([]);
    setPkgQuery("");
    setPkgAssign({ status: "active", starts_at: "", ends_at: "" });
    setPkgOpen(true);

    setPkgLoading(true);
    try {
      // Load BOTH:
      // 1) master packages list (for suggestions)
      // 2) current packages for this user (to pre-select)
      const [all, cur] = await Promise.all([listAllPackages(), listUserPackages(u.id)]);

      setPackages(all);

      const byId = new Map<number, Package>();
      for (const p of all) byId.set(p.id, p);

      const selected: Package[] = cur.map((it) => {
        const known = byId.get(it.package_id);
        if (known) return known;
        return {
          id: it.package_id,
          name: it.package_name || `#${it.package_id}`,
        };
      });

      // de-dupe
      const seen = new Set<number>();
      const unique = selected.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

      setPkgSelected(unique);

      if (all.length === 0) {
        toast.push({
          type: "info",
          title: "No packages available",
          message: "Create a package on the Packages page before assigning it to a user.",
        });
      }
    } catch (e: any) {
      toast.push({
        type: "error",
        title: "Packages load failed",
        message: e?.message || "Unable to load packages",
      });
    } finally {
      setPkgLoading(false);
    }
  }

  async function refreshRowPackages(userId: number) {
    try {
      const items = await listUserPackages(userId);
      const names = items
        .map((x) => x.package_name || `#${x.package_id}`)
        .filter(Boolean);
      const label = names.length ? names.join(", ") : "—";
      setPkgMap((cur) => ({ ...cur, [userId]: label }));
    } catch {
      setPkgMap((cur) => ({ ...cur, [userId]: "ERR" }));
    }
  }

  async function hydratePackagesForRows(users: RegUser[]) {
    if (users.length === 0) return;

    // Only fetch for users not yet cached
    const toFetch = users
      .map((u) => u.id)
      .filter((id) => pkgMap[id] === undefined);

    if (toFetch.length === 0) return;

    setPkgMapLoading(true);
    try {
      const concurrency = 8;
      const nextMap: Record<number, string> = {};

      for (let i = 0; i < toFetch.length; i += concurrency) {
        const chunk = toFetch.slice(i, i + concurrency);

        const results = await Promise.all(
          chunk.map(async (id) => {
            try {
              const items = await listUserPackages(id);
              const names = items
                .map((x) => x.package_name || `#${x.package_id}`)
                .filter(Boolean);
              const label = names.length ? names.join(", ") : "—";
              return { id, label };
            } catch {
              return { id, label: "ERR" };
            }
          })
        );

        for (const r of results) nextMap[r.id] = r.label;
      }

      setPkgMap((cur) => ({ ...cur, ...nextMap }));
    } finally {
      setPkgMapLoading(false);
    }
  }

  function validateCreate(f: CreateForm): string | null {
    if (!f.username?.trim()) return "Username is required.";
    if (!f.password?.trim()) return "Password is required.";
    if (f.password.trim().length < 6) return "Password must be at least 6 characters.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return "Email looks invalid.";
    if (f.max_connections < 1) return "Max Connections must be >= 1.";
    if (f.max_live_devices < 1) return "Max Live Devices must be >= 1.";
    return null;
  }

  function validateEdit(f: EditForm): string | null {
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return "Email looks invalid.";
    if (f.max_connections < 1) return "Max Connections must be >= 1.";
    if (f.max_live_devices < 1) return "Max Live Devices must be >= 1.";
    return null;
  }

  function validatePw(f: PasswordForm): string | null {
    if (!f.password.trim()) return "New password is required.";
    if (f.password.trim().length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  function validatePkg(): string | null {
    if (!pkgUser) return "No user selected.";
    // Allow empty selection (meaning: remove all packages)
    if (!isValidDateTimeLoose(pkgAssign.starts_at))
      return "starts_at must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS";
    if (!isValidDateTimeLoose(pkgAssign.ends_at))
      return "ends_at must be YYYY-MM-DD or YYYY-MM-DD HH:MM:SS";
    return null;
  }

  async function save() {
    if (saving) return;

    setSaving(true);
    try {
      if (editing) {
        const f = form as EditForm;
        const err = validateEdit(f);
        if (err) throw new Error(err);

        const payload: any = {
          full_name: f.full_name || null,
          email: f.email || null,
          address: f.address || null,
          area: f.area || null,
          telephone: f.telephone || null,
          zipcode: f.zipcode ? Number(f.zipcode) : null,
          notes: f.notes || null,
          status: f.status,
          account_expiry: f.account_expiry || null,
          is_trial: f.is_trial,
          max_connections: f.max_connections,
          max_live_devices: f.max_live_devices,
          bump_auth_epoch: f.bump_auth_epoch,
          bump_entitlements: f.bump_entitlements,
        };

        await updateRegUser(editing.id, payload);
        toast.push({ type: "ok", title: "User updated" });
      } else {
        const f = form as CreateForm;
        const err = validateCreate(f);
        if (err) throw new Error(err);

        const payload: any = {
          username: f.username.trim(),
          password: f.password.trim(),
          full_name: f.full_name || null,
          email: f.email || null,
          address: f.address || null,
          area: f.area || null,
          telephone: f.telephone || null,
          zipcode: f.zipcode ? Number(f.zipcode) : null,
          notes: f.notes || null,
          status: f.status,
          account_expiry: f.account_expiry || null,
          is_trial: f.is_trial,
          max_connections: f.max_connections,
          max_live_devices: f.max_live_devices,
        };

        await createRegUser(payload);
        toast.push({ type: "ok", title: "User created" });
      }

      setEditOpen(false);
      await reload();
    } catch (e: any) {
      toast.push({
        type: "error",
        title: "Save failed",
        message: e?.message || "Unable to save user",
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!pwUser || pwSaving) return;

    setPwSaving(true);
    try {
      const err = validatePw(pwForm);
      if (err) throw new Error(err);

      await updateRegUser(pwUser.id, {
        password: pwForm.password.trim(),
        bump_auth_epoch: pwForm.bump_auth_epoch,
      });

      toast.push({ type: "ok", title: "Password updated" });
      setPwOpen(false);
      setPwUser(null);
      await reload();
    } catch (e: any) {
      toast.push({
        type: "error",
        title: "Password update failed",
        message: e?.message || "Unable to update password",
      });
    } finally {
      setPwSaving(false);
    }
  }

  // SAVE packages = sync current assignments to match selected list
  // - removes deselected
  // - adds newly selected
  async function savePackages() {
    if (pkgSaving) return;

    const err = validatePkg();
    if (err) {
      toast.push({ type: "error", title: "Check package details", message: err });
      return;
    }

    setPkgSaving(true);
    try {
      const uid = pkgUser!.id;

      const payloadBase: any = {
        status: pkgAssign.status,
        starts_at: pkgAssign.starts_at.trim() ? pkgAssign.starts_at.trim() : null,
        ends_at: pkgAssign.ends_at.trim() ? pkgAssign.ends_at.trim() : null,
      };

      // current assignments (source of truth)
      const current = await listUserPackages(uid);
      const currentIds = new Set(current.map((x) => x.package_id));
      const desiredIds = new Set(pkgSelected.map((x) => x.id));

      const toAdd = pkgSelected.filter((p) => !currentIds.has(p.id));
      const toDel = current.filter((x) => !desiredIds.has(x.package_id));

      let addOk = 0;
      let delOk = 0;
      const failures: string[] = [];

      // delete first (so re-adding is clean if your backend enforces uniqueness)
      for (const it of toDel) {
        try {
          await deleteUserPackage(uid, it.package_id);
          delOk++;
        } catch (e: any) {
          const msg =
            e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
          failures.push(`Could not remove package #${it.package_id}: ${msg}`);
        }
      }

      for (const p of toAdd) {
        try {
          await createUserPackage(uid, { package_id: p.id, ...payloadBase });
          addOk++;
        } catch (e: any) {
          const msg =
            e?.message || e?.error || (typeof e === "string" ? e : JSON.stringify(e));
          failures.push(`Could not add ${p.name}: ${msg}`);
        }
      }

      // refresh ONLY this row packages label
      await refreshRowPackages(uid);

      if (failures.length === 0) {
        toast.push({
          type: "ok",
          title: "Packages saved",
          message: `Removed ${delOk}, added ${addOk}.`,
        });
        setPkgOpen(false);
        setPkgUser(null);
        setPkgSelected([]);
      } else {
        console.error("Package save failures:", failures);
        toast.push({
          type: "error",
          title: "Some package changes failed",
          message: failures.slice(0, 2).join(" | "),
        });
      }
    } finally {
      setPkgSaving(false);
    }
  }

  async function doDelete(u: RegUser) {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteRegUser(u.id);
      toast.push({ type: "ok", title: "User deleted" });
      setConfirmDel(null);

      if (rows.length === 1 && offset > 0) {
        const o = Math.max(0, offset - limit);
        setOffset(o);
        await reload({ offset: o });
      } else {
        await reload();
      }
    } catch (e: any) {
      toast.push({
        type: "error",
        title: "Delete failed",
        message: e?.message || "Unable to delete user",
      });
    } finally {
      setDeleting(false);
    }
  }

  // close menu on outside click / escape
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (!target.closest("[data-actions-menu]") && !target.closest("[data-actions-trigger]")) {
        closeMenu();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { closeMenu(); menuTrigger.current?.focus({ preventScroll: true }); }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const filtered = rows.filter((u) => {
    const hay = `${u.username} ${u.full_name ?? ""} ${u.email ?? ""} ${u.telephone ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const page = Math.floor(offset / limit) + 1;
  const totalKnown = Math.max(total, rows.length);
  const totalPages = Math.max(1, Math.ceil(totalKnown / limit));
  const showingFrom = totalKnown === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, totalKnown);

  function goFirst() {
    setOffset(0);
    reload({ offset: 0 });
  }
  function goPrev() {
    const o = Math.max(0, offset - limit);
    setOffset(o);
    reload({ offset: o });
  }
  function goNext() {
    if (rows.length < limit) return;
    const o = offset + limit;
    setOffset(o);
    reload({ offset: o });
  }
  function goLast() {
    const o = Math.max(0, (totalPages - 1) * limit);
    setOffset(o);
    reload({ offset: o });
  }
  function changeLimit(newLimit: number) {
    setLimit(newLimit);
    setOffset(0);
    reload({ limit: newLimit, offset: 0 });
  }

  // --- Packages suggest dropdown ---
  const pkgSuggestions = React.useMemo(() => {
    const nq = norm(pkgQuery);
    const selectedIds = new Set(pkgSelected.map((p) => p.id));
    const base = packages.filter((p) => !selectedIds.has(p.id));

    if (!nq) return base.slice(0, 12);

    const f = base.filter((p) => {
      const h = `${p.name} #${p.id}`.toLowerCase();
      return h.includes(nq);
    });

    return f.slice(0, 12);
  }, [packages, pkgQuery, pkgSelected]);

  function addPkg(p: Package) {
    if (pkgSelected.some((x) => x.id === p.id)) return;
    setPkgSelected([...pkgSelected, p]);
    setPkgQuery("");
  }
  function removePkg(id: number) {
    setPkgSelected(pkgSelected.filter((p) => p.id !== id));
  }

  return (
    <div className="container ru-page">
      <header className="ru-header">
        <h1 className="h1">Users</h1>
        <p>Manage user accounts, package access, and subscriptions.</p>
      </header>

      <div className="ru-toolbar">
        <div className="ru-user-count" role="status">
          <span className="ru-count-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>

          <span className="ru-count-label">Total users</span><span className="ru-count-copy">{loading ? <span>Loading&hellip;</span> : <><strong className="ru-count-value">{totalKnown || filtered.length}</strong><span>{(totalKnown || filtered.length) === 1 ? "user" : "users"}</span></>}</span>
        </div>

        <div className="ru-toolbar-controls">
          <label className="ru-search-field">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" aria-label="Search users on the current page" placeholder="Search users on this page..." value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="ru-toolbar-button" type="button" disabled={loading} onClick={() => reload()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v6h-6M4 20v-6h6"/><path d="M5.6 8a7 7 0 0 1 11.5-2L20 10M4 14l2.9 4A7 7 0 0 0 18.4 16"/></svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="ru-toolbar-button ru-new-user" type="button" disabled={loading} onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            New user
          </button>
        </div>
      </div>
      {/* table */}
      <section className="ru-directory" aria-label="User directory" aria-busy={loading}>
      <div className="ru-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Packages</th>
              <th>Status</th>
              <th>Trial</th>
              <th>Connections</th>
              <th className="ru-actions-heading" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="ru-id">#{u.id}</td>
                <td>
                  <b>{u.username}</b>
                </td>
                <td>{u.full_name || <span className="ru-empty-value">&mdash;</span>}</td>
                <td>{u.email || <span className="ru-empty-value">&mdash;</span>}</td>
                <td className="ru-packages-cell"><span className="ru-package-tag">{pkgMap[u.id] ?? (pkgMapLoading ? "Loading..." : "No package")}</span></td>
                <td><span className={`ru-status ru-status-${u.status}`}><i />{u.status}</span></td>
                <td><span className="ru-trial">{u.is_trial ? "Trial" : "Standard"}</span></td>
                <td>{u.max_connections}</td>

                <td style={{ whiteSpace: "nowrap", position: "relative" }}>
                  <button
                    className="ru-actions-btn"
                    data-actions-trigger
                    onClick={(e) => toggleMenu(u.id, e.currentTarget)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpenFor === u.id}
                    title="Actions"
                    aria-label={`Actions for ${u.username}`}
                    type="button"
                  >
                    <span className="ru-burger" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </button>

                  {menuOpenFor === u.id && createPortal(
                    <div ref={menuRef} className="ru-actions-menu ru-floating-menu" style={menuPosition} data-actions-menu role="menu" aria-label={`Actions for ${u.username}`} onKeyDown={(e) => {
                      const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
                      const current = items.indexOf(document.activeElement as HTMLButtonElement);
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(current + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
                      if (e.key === 'Tab') closeMenu();
                    }}>
                      <button
                        className="ru-actions-item"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          openInfo(u);
                        }}
                      >
                        <IconInfo />
                        <span>View details</span>
                      </button>

                      <button
                        className="ru-actions-item"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          openEdit(u);
                        }}
                      >
                        <IconEdit />
                        <span>Edit</span>
                      </button>

                      <button
                        className="ru-actions-item"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          openPassword(u);
                        }}
                      >
                        <IconKey />
                        <span>Change password</span>
                      </button>

                      <button
                        className="ru-actions-item"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          openPackages(u);
                        }}
                      >
                        <IconBox />
                        <span>Packages</span>
                      </button>
                      <button
                        className="ru-actions-item danger"
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          closeMenu();
                          setConfirmDel(u);
                        }}
                      >
                        <IconTrash />
                        <span>Delete</span>
                      </button>
                    </div>, document.body
                  )}
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 16 }}>
                  No users found on this page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ru-pagination">
        <span className="ru-range" role="status">{loading ? "Loading users..." : `Showing ${showingFrom}-${showingTo} of ${totalKnown} users`}</span>
        <div className="ru-page-size"><label htmlFor="ru-page-size">Rows per page</label><select id="ru-page-size" className="select" value={limit} onChange={(e) => changeLimit(Number(e.target.value))} disabled={loading}>{[10, 25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
        <nav className="ru-pagination-controls" aria-label="Users pagination">
          <button className="btn small" disabled={loading || offset <= 0} onClick={goFirst} aria-label="First page">&laquo;</button>
          <button className="btn small" disabled={loading || offset <= 0} onClick={goPrev} aria-label="Previous page">&lsaquo;</button>
          <span>Page <strong>{page}</strong> of {totalPages}</span>
          <button className="btn small" disabled={loading || page >= totalPages} onClick={goNext} aria-label="Next page">&rsaquo;</button>
          <button className="btn small" disabled={loading || page >= totalPages} onClick={goLast} aria-label="Last page">&raquo;</button>
        </nav>
      </div>
      </section>

      {/* ===================== CREATE / EDIT MODAL ===================== */}
      <Modal
        open={editOpen}
        className="ru-editor-modal"
        subtitle={editing ? "Update profile details and account access." : "Set up a profile and configure account access. Fields marked * are required."}
        title={editing ? `Edit user: ${editing.username}` : "New user"}
        onClose={() => { if (!saving) setEditOpen(false); }}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" disabled={saving} onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create user"}
            </button>
          </div>
        }
      >
        <div className={`ru-form ru-wide-form${editing ? " is-editing" : ""}`}>
          {!editing && (
            <section className="ru-form-panel ru-login-panel">
              <div className="ru-section-title"><h3>Sign-in details</h3><p>Credentials the user will use to sign in.</p></div>
              <div className="ru-grid2">
                <label className="ru-field">
                  <span className="ru-label">Username *</span>
                  <input
                    className="input"
                    value={(form as CreateForm).username}
                    onChange={(e) =>
                      setForm((cur: any) => ({ ...cur, username: e.target.value }))
                    }
                    placeholder="Choose a username" autoComplete="off" required
                  />
                </label>

                <label className="ru-field">
                  <span className="ru-label">Password *</span>
                  <input
                    className="input"
                    type="password"
                    value={(form as CreateForm).password}
                    onChange={(e) =>
                      setForm((cur: any) => ({ ...cur, password: e.target.value }))
                    }
                    placeholder="At least 6 characters" autoComplete="new-password" required minLength={6}
                  />
                </label>
              </div>

            </section>
          )}

          <section className="ru-form-panel ru-personal-panel">
          <div className="ru-section-title"><h3>Personal information</h3><p>Contact details for this account.</p></div>
          <div className="ru-grid2">
            <label className="ru-field">
              <span className="ru-label">Full name</span>
              <input
                className="input"
                value={(form as any).full_name}
                onChange={(e) => setForm((cur: any) => ({ ...cur, full_name: e.target.value }))}
              />
            </label>

            <label className="ru-field">
              <span className="ru-label">Email</span>
              <input
                className="input"
                value={(form as any).email}
                onChange={(e) => setForm((cur: any) => ({ ...cur, email: e.target.value }))}
              />
            </label>
          </div>

          <div className="ru-grid2">
            <label className="ru-field">
              <span className="ru-label">Address</span>
              <input
                className="input"
                value={(form as any).address}
                onChange={(e) => setForm((cur: any) => ({ ...cur, address: e.target.value }))}
              />
            </label>

            <label className="ru-field">
              <span className="ru-label">Area</span>
              <input
                className="input"
                value={(form as any).area}
                onChange={(e) => setForm((cur: any) => ({ ...cur, area: e.target.value }))}
              />
            </label>
          </div>

          <div className="ru-grid2">
            <label className="ru-field">
              <span className="ru-label">Telephone</span>
              <input
                className="input"
                value={(form as any).telephone}
                onChange={(e) => setForm((cur: any) => ({ ...cur, telephone: e.target.value }))}
              />
            </label>

            <label className="ru-field">
              <span className="ru-label">Zip code</span>
              <input
                className="input"
                value={(form as any).zipcode}
                onChange={(e) => setForm((cur: any) => ({ ...cur, zipcode: e.target.value }))}
              />
            </label>
          </div>

          <label className="ru-field">
            <span className="ru-label">Notes</span>
            <textarea
              className="textarea"
              value={(form as any).notes}
              onChange={(e) => setForm((cur: any) => ({ ...cur, notes: e.target.value }))}
              rows={3}
            />
          </label>

          </section>
          <section className="ru-form-panel ru-access-panel">
          <div className="ru-section-title ru-access-title"><h3>Account access</h3><p>Set availability, expiry, and device limits.</p></div>
          <div className="ru-grid3">
            <label className="ru-field">
              <span className="ru-label">Status</span>
              <select
                className="select"
                value={(form as any).status}
                onChange={(e) => setForm((cur: any) => ({ ...cur, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
                <option value="suspended">suspended</option>
              </select>
            </label>

            <label className="ru-field">
              <span className="ru-label">Account expiry</span>
              <input
                className="input"
                value={(form as any).account_expiry}
                onChange={(e) =>
                  setForm((cur: any) => ({ ...cur, account_expiry: e.target.value }))
                }
                placeholder="YYYY-MM-DD HH:MM:SS"
              />
            </label>

            <label className="ru-field">
              <span className="ru-label">Trial</span>
              <select
                className="select"
                value={(form as any).is_trial}
                onChange={(e) => setForm((cur: any) => ({ ...cur, is_trial: to01(e.target.value) }))}
              >
                <option value={0}>no</option>
                <option value={1}>yes</option>
              </select>
            </label>
          </div>

          <div className="ru-grid2">
            <label className="ru-field">
              <span className="ru-label">Max connections</span>
              <input
                className="input"
                type="number"
                min={1}
                value={(form as any).max_connections}
                onChange={(e) =>
                  setForm((cur: any) => ({
                    ...cur,
                    max_connections: safeNum(e.target.value, 1),
                  }))
                }
              />
            </label>

            <label className="ru-field">
              <span className="ru-label">Max live devices</span>
              <input
                className="input"
                type="number"
                min={1}
                value={(form as any).max_live_devices}
                onChange={(e) =>
                  setForm((cur: any) => ({
                    ...cur,
                    max_live_devices: safeNum(e.target.value, 1),
                  }))
                }
              />
            </label>
          </div>

          {editing && (
            <>
              <div className="ru-divider" />

              <div className="ru-grid2">
                <label className="ru-field">
                  <span className="ru-label">Sign out existing sessions</span>
                  <select
                    className="select"
                    value={(form as EditForm).bump_auth_epoch}
                    onChange={(e) =>
                      setForm((cur: any) => ({ ...cur, bump_auth_epoch: to01(e.target.value) }))
                    }
                  >
                    <option value={0}>no</option>
                    <option value={1}>yes</option>
                  </select>
                </label>

                <label className="ru-field">
                  <span className="ru-label">Refresh access permissions</span>
                  <select
                    className="select"
                    value={(form as EditForm).bump_entitlements}
                    onChange={(e) =>
                      setForm((cur: any) => ({ ...cur, bump_entitlements: to01(e.target.value) }))
                    }
                  >
                    <option value={0}>no</option>
                    <option value={1}>yes</option>
                  </select>
                </label>
              </div>
            </>
          )}
          </section>
        </div>
      </Modal>

      {/* ===================== PASSWORD MODAL ===================== */}
      <Modal
        open={pwOpen}
        className="ru-editor-modal ru-action-modal ru-password-modal"
        subtitle="Choose a new password and manage existing sign-ins."
        title={pwUser ? `Change password: ${pwUser.username}` : "Change password"}
        onClose={() => { if (!pwSaving) setPwOpen(false); }}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" disabled={pwSaving} onClick={() => setPwOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={pwSaving} onClick={savePassword}>
              {pwSaving ? "Saving…" : "Update password"}
            </button>
          </div>
        }
      >
        <div className="ru-form">
          <label className="ru-field">
            <span className="ru-label">New password *</span>
            <input
              className="input"
              type="password"
              value={pwForm.password}
              onChange={(e) => setPwForm((cur) => ({ ...cur, password: e.target.value }))}
              placeholder="At least 6 characters" autoComplete="new-password"
            />
          </label>

          <label className="ru-field">
            <span className="ru-label">Sign out existing sessions</span>
            <select
              className="select"
              value={pwForm.bump_auth_epoch}
              onChange={(e) => setPwForm((cur) => ({ ...cur, bump_auth_epoch: to01(e.target.value) }))}
            >
              <option value={0}>No</option>
              <option value={1}>Yes</option>
            </select>
          </label>

          <p className="muted" style={{ marginTop: 8 }}>
            Choose Yes to invalidate existing sessions when the password changes.
          </p>
        </div>
      </Modal>

      {/* ===================== INFO MODAL ===================== */}
      <Modal
        open={infoOpen}
        className="ru-editor-modal ru-action-modal ru-info-modal"
        subtitle="Profile, subscription access, and account details."
        title={infoUser ? `User details: ${infoUser.username}` : "User details"}
        onClose={() => setInfoOpen(false)}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setInfoOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {infoUser ? (
          <div className="ru-info">
            <div className="ru-profile-summary"><span className="ru-profile-avatar" aria-hidden="true">{infoUser.username.slice(0, 2).toUpperCase()}</span><div><h2>{infoUser.full_name || infoUser.username}</h2><p>@{infoUser.username} &middot; User #{infoUser.id}</p></div><span className={`ru-status ru-status-${infoUser.status}`}><i />{infoUser.status}</span></div>
            <div className="ru-info-sections">
              <section><h3>Contact details</h3><dl>{[
                ["Full name", infoUser.full_name], ["Email", infoUser.email], ["Telephone", infoUser.telephone],
                ["Address", infoUser.address], ["Area", infoUser.area], ["Zip code", infoUser.zipcode],
              ].map(([label, value]) => <div key={label} className="ru-detail"><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section>
              <section><h3>Account access</h3><dl>{[
                ["Account type", infoUser.is_trial ? "Trial" : "Standard"], ["Max connections", infoUser.max_connections],
                ["Max live devices", infoUser.max_live_devices], ["Account expiry", infoUser.account_expiry || "Not set"],
                ["Packages", pkgMap[infoUser.id] ?? "Not available"],
              ].map(([label, value]) => <div key={label} className="ru-detail"><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
            </div>
            {infoUser.notes && <section className="ru-info-notes"><h3>Notes</h3><p>{infoUser.notes}</p></section>}
            <details className="ru-technical"><summary>Technical account details</summary><dl><div className="ru-detail"><dt>Auth epoch</dt><dd>{(infoUser as any).auth_epoch ?? "Not available"}</dd></div><div className="ru-detail"><dt>Entitlements version</dt><dd>{(infoUser as any).entitlements_version ?? "Not available"}</dd></div></dl></details>
          </div>
        ) : (
          <div className="muted">No user selected.</div>
        )}
      </Modal>

      {/* ===================== PACKAGES MODAL ===================== */}
      <Modal
        open={pkgOpen}
        className="ru-editor-modal ru-action-modal ru-packages-modal"
        subtitle="Manage package assignments. Status and dates apply to newly added packages."
        title={pkgUser ? `Packages: ${pkgUser.username}` : "Packages"}
        onClose={() => { if (!pkgSaving) setPkgOpen(false); }}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" disabled={pkgSaving} onClick={() => setPkgOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={pkgSaving} onClick={savePackages}>
              {pkgSaving ? "Saving…" : "Save packages"}
            </button>
          </div>
        }
      >
        <div className="ru-form">
          {pkgLoading ? (
            <div className="muted">Loading packages…</div>
          ) : (
            <>
              <div className="ru-grid3">
                <label className="ru-field">
                  <span className="ru-label">Status</span>
                  <select
                    className="select"
                    value={pkgAssign.status}
                    onChange={(e) =>
                      setPkgAssign((cur) => ({ ...cur, status: e.target.value as any }))
                    }
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="expired">expired</option>
                  </select>
                </label>

                <label className="ru-field">
                  <span className="ru-label">Starts at</span>
                  <input
                    className="input"
                    value={pkgAssign.starts_at}
                    onChange={(e) => setPkgAssign((cur) => ({ ...cur, starts_at: e.target.value }))}
                    placeholder="YYYY-MM-DD HH:MM:SS (optional)"
                  />
                </label>

                <label className="ru-field">
                  <span className="ru-label">Ends at</span>
                  <input
                    className="input"
                    value={pkgAssign.ends_at}
                    onChange={(e) => setPkgAssign((cur) => ({ ...cur, ends_at: e.target.value }))}
                    placeholder="YYYY-MM-DD HH:MM:SS (optional)"
                  />
                </label>
              </div>

              <div className="ru-divider" />

              {/* Selected chips */}
              <div className="ru-row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="muted" style={{ minWidth: 92 }}>
                  Selected:
                </span>

                {pkgSelected.length === 0 ? (
                  <span className="muted">— none (saving will remove all)</span>
                ) : (
                  pkgSelected.map((p) => (
                    <span key={p.id} className="ru-chip">
                      {p.name} <span className="muted">#{p.id}</span>
                      <button
                        className="ru-chip-x"
                        type="button"
                        onClick={() => removePkg(p.id)}
                        aria-label={`Remove ${p.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div style={{ height: 10 }} />

              {/* Suggest + multi-select input */}
              <div className="ru-suggest">
                <input
                  className="input"
                  aria-label="Search packages"
                  value={pkgQuery}
                  onChange={(e) => setPkgQuery(e.target.value)}
                  placeholder="Type to search packages…"
                />

                {pkgSuggestions.length > 0 && pkgQuery.trim() !== "" && (
                  <div className="ru-suggest-dd">
                    {pkgSuggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="ru-suggest-item"
                        onClick={() => addPkg(p)}
                      >
                        <span>{p.name}</span>
                        <span className="muted">#{p.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="muted" style={{ marginTop: 10 }}>
                Saving adds and removes packages to match your selection. Status and dates apply only to newly added packages; existing assignments keep their current settings.
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* ===================== DELETE CONFIRM ===================== */}
      <Confirm
        open={!!confirmDel}
        title="Delete user?"
        message={
          confirmDel
            ? `Delete ${confirmDel.username} (ID ${confirmDel.id})? This cannot be undone.`
            : "Delete this user?"
        }
        confirmText={deleting ? "Deleting…" : "Delete"}
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await doDelete(confirmDel);
        }}
      />


    </div>
  );
}
