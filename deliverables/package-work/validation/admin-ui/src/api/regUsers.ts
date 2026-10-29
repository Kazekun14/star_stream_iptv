import { http } from "./http";

export type RegUser = {
  id: number;
  username: string;

  full_name?: string | null;
  email?: string | null;

  address?: string | null;
  area?: string | null;
  telephone?: string | null;
  zipcode?: number | null;
  notes?: string | null;

  status: "active" | "disabled" | "suspended";
  account_expiry?: string | null;

  is_trial: number;
  max_connections: number;
  max_live_devices: number;

  auth_epoch: number;
  entitlements_version: number;
  hls_server_id?: number | null;

  created_at: string;
  updated_at: string;
};

type ListRes = {
  ok: boolean;
  items?: RegUser[];
  paging?: {
    limit: number;
    offset: number;
    total: number;
  };
  error?: string;
};

type GetRes = {
  ok: boolean;
  item?: RegUser;
  error?: string;
};


type RegUserPackage = {
  user_id: number;
  package_id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: "active" | "paused" | "expired";
};

type ListUserPackagesRes = {
  ok: boolean;
  items?: RegUserPackage[];
  error?: string;
};

/**
 * GET /live/users
 */
export async function listRegUsers(params?: {
  q?: string;
  status?: "active" | "disabled" | "suspended";
  limit?: number;
  offset?: number;
}): Promise<RegUser[]> {

  let url = "/live/reg-users";

  if (params) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    if (params.offset !== undefined) qs.set("offset", String(params.offset));

    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const res = await http.get<ListRes>(url);
  if (!res.ok) throw new Error(res.error || "Failed to load users");
  return res.items || [];
}

/**
 * GET /live/users/{id}
 */
export async function getRegUser(id: number): Promise<RegUser> {
  const res = await http.get<GetRes>(`/live/reg-users/${id}`);
  if (!res.ok || !res.item) throw new Error(res.error || "Not found");
  return res.item;
}

/**
 * POST /live/users
 */
export async function createRegUser(payload: Partial<RegUser> & {
  username: string;
  password: string;
}) {
  return http.post("/live/reg-users", payload);
}

/**
 * PUT /live/users/{id}
 */
export async function updateRegUser(
  id: number,
  payload: Partial<RegUser> & {
    password?: string;
    bump_auth_epoch?: 0 | 1;
    bump_entitlements?: 0 | 1;
  }
) {
  return http.put(`/live/reg-users/${id}`, payload);
}

 

/**
 * DELETE /live/users/{id}
 */
export async function deleteRegUser(id: number) {
  return http.del(`/live/reg-users/${id}`);
}


/**
 * GET /live/reg-users/{id}/packages
 * Returns user_packages rows for that user.
 */
export async function listRegUserPackages(userId: number): Promise<RegUserPackage[]> {
  const res = await http.get<ListUserPackagesRes>(`/live/reg-users/${userId}/packages`);
  if (!res.ok) throw new Error(res.error || "Failed to load user packages");
  return res.items || [];
}

/**
 * GET /live/reg-users/{id}/packages (count helper)
 * Uses the list endpoint and returns items.length.
 * If you later create a dedicated /count endpoint, replace implementation here.
 */
export async function getRegUserPackageCount(userId: number): Promise<number> {
  try {
    const items = await listRegUserPackages(userId);
    return items.length;
  } catch {
    return 0;
  }
}