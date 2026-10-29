// src/api/userPackages.ts
import { http } from "./http";

export type UserPackageStatus = "active" | "paused" | "expired";

export type UserPackage = {
  user_id: number;
  package_id: number;

  starts_at: string | null;
  ends_at: string | null;

  status: UserPackageStatus;

  // optional (if backend joins packages.name)
  package_name?: string;
};

type ListRes = {
  ok: boolean;
  items?: UserPackage[];
  error?: string;
};

type MutRes = {
  ok: boolean;
  error?: string;
};

export async function listUserPackages(userId: number, params?: {
  status?: UserPackageStatus;
}): Promise<UserPackage[]> {
  let url = `/live/reg-users/${userId}/packages`;

  if (params?.status) {
    const qs = new URLSearchParams();
    qs.set("status", params.status);
    url += `?${qs.toString()}`;
  }

  const res = await http.get<ListRes>(url);
  if (!res.ok) throw new Error(res.error || "Failed to load user packages");
  return res.items || [];
}

/**
 * POST /live/reg-users/:id/packages
 * Creates assignment (fails if duplicate primary key user_id+package_id)
 */
export async function createUserPackage(userId: number, payload: {
  package_id: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: UserPackageStatus;
}) {
  const res = await http.post<MutRes>(`/live/reg-users/${userId}/packages`, payload);
  if (!res.ok) throw new Error(res.error || "Failed to assign package");
  return res;
}

/**
 * PUT /live/reg-users/:id/packages/:package_id
 * Updates assignment (partial: any of starts_at, ends_at, status)
 */
export async function updateUserPackage(
  userId: number,
  packageId: number,
  payload: {
    starts_at?: string | null;
    ends_at?: string | null;
    status?: UserPackageStatus;
  }
) {
  const res = await http.put<MutRes>(`/live/reg-users/${userId}/packages/${packageId}`, payload);
  if (!res.ok) throw new Error(res.error || "Failed to update user package");
  return res;
}

/**
 * DELETE /live/reg-users/:id/packages/:package_id
 */
export async function deleteUserPackage(userId: number, packageId: number) {
  const res = await http.del<MutRes>(`/live/reg-users/${userId}/packages/${packageId}`);
  if (!res.ok) throw new Error(res.error || "Failed to remove user package");
  return res;
}
