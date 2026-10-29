import { http } from "./http";
import type { Ok } from "./types";

export type Package = {
  id: number;
  name: string;
  status: "active" | "disabled";
  created_at?: string | null;
  updated_at?: string | null;
};

type ListRes = { ok: boolean; packages?: Package[]; items?: Package[]; data?: Package[]; message?: string; error?: string };
type GetRes  = { ok: boolean; package?: Package; item?: Package; data?: Package; message?: string; error?: string };

export async function listPackages(): Promise<Package[]> {
  const res = await http.get<ListRes>("/live/packages");
  if (!res.ok) throw new Error(res.message || res.error || "Failed to load packages");
  return (res.packages || res.items || res.data || []) as Package[];
}

export async function getPackage(id: number): Promise<Package> {
  const res = await http.get<GetRes>(`/live/packages/${id}`);
  if (!res.ok) throw new Error(res.message || res.error || "Failed to load package");
  return (res.package || res.item || res.data) as Package;
}

export async function createPackage(payload: Partial<Package>): Promise<Package | Ok> {
  return http.post("/live/packages", payload as any);
}

export async function updatePackage(id: number, payload: Partial<Package>): Promise<Package | Ok> {
  return http.put(`/live/packages/${id}`, payload as any);
}

export async function deletePackage(id: number): Promise<Ok> {
  return http.del<Ok>(`/live/packages/${id}`);
}
